<?php
namespace Espo\Modules\RutasCapacitacion\Controllers;

use Espo\Core\Exceptions\BadRequest;
use Espo\Core\Exceptions\Forbidden;
use Espo\Core\Utils\Config;
use Espo\Entities\User;
use Espo\ORM\EntityManager;

class RutasCapacitacionRutas
{
    public function __construct(
        private EntityManager $entityManager,
        private User $user,
        private Config $config
    ) {}

    // Extensiones/mimes permitidos: PDF, imágenes, Word, Excel, PowerPoint
    private $extensionesPermitidas = [
        'pdf',
        'jpg', 'jpeg', 'png', 'gif', 'webp',
        'doc', 'docx',
        'xls', 'xlsx',
        'ppt', 'pptx'
    ];

    private $mimesPermitidos = [
        'application/pdf',
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    // Permisos del usuario actual (la vista decide con esto si muestra los botones de gestión)
    public function getActionGetUserInfo($params, $data, $request)
    {
        try {
            $pdo = $this->entityManager->getPDO();

            return [
                'success' => true,
                'data'    => [
                    'esAdmin'        => $this->user->isAdmin(),
                    'esCasaNacional' => in_array('casa nacional', $this->getRolesUsuario($this->user->get('id'), $pdo)),
                ],
            ];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // Roles del sistema para el selector de "Roles con acceso" (solo Casa Nacional / admin)
    public function getActionGetRolesDisponibles($params, $data, $request)
    {
        try {
            $this->checkEsCasaNacional();

            $pdo = $this->entityManager->getPDO();

            $sth = $pdo->prepare("SELECT id, name FROM role WHERE deleted = 0 ORDER BY name");
            $sth->execute();

            $roles = [];
            while ($row = $sth->fetch(\PDO::FETCH_ASSOC)) {
                $roles[] = ['id' => $row['id'], 'name' => $row['name']];
            }

            return ['success' => true, 'data' => $roles];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function getActionGetLista($params, $data, $request)
    {
        try {
            $pdo     = $this->entityManager->getPDO();
            $siteUrl = rtrim($this->config->get('siteUrl', ''), '/');

            $rolesUsuario = $this->getRolesUsuario($this->user->get('id'), $pdo);
            $verTodo = $this->user->isAdmin() || in_array('casa nacional', $rolesUsuario);

            $sql = "SELECT
                        r.id,
                        r.nombre,
                        r.descripcion,
                        r.orden,
                        r.roles,
                        r.archivo_id,
                        a.name AS archivo_nombre,
                        a.size AS archivo_size,
                        a.type AS archivo_tipo
                    FROM rutas_capacitacion_rutas r
                    LEFT JOIN attachment a ON a.id = r.archivo_id AND a.deleted = 0
                    WHERE r.deleted = 0
                    ORDER BY r.orden ASC, r.created_at ASC";

            $sth = $pdo->prepare($sql);
            $sth->execute();
            $rows = $sth->fetchAll(\PDO::FETCH_ASSOC);

            $lista = [];
            foreach ($rows as $row) {
                $rolesDoc = $this->parseRoles($row['roles']);

                if (!$verTodo) {
                    // Se muestra si el usuario tiene AL MENOS UNO de los roles
                    // asignados al documento (los roles no son excluyentes entre sí).
                    $tieneAcceso = false;
                    foreach ($rolesDoc as $rolDoc) {
                        if (in_array($rolDoc, $rolesUsuario)) {
                            $tieneAcceso = true;
                            break;
                        }
                    }
                    if (!$tieneAcceso) {
                        continue;
                    }
                }

                $lista[] = [
                    'id'            => $row['id'],
                    'nombre'        => $row['nombre'],
                    'descripcion'   => $row['descripcion'],
                    'orden'         => (int) $row['orden'],
                    'roles'         => $rolesDoc,
                    'archivoId'     => $row['archivo_id'],
                    'archivoNombre' => $row['archivo_nombre'],
                    'archivoSize'   => $row['archivo_size'] !== null ? (int) $row['archivo_size'] : null,
                    'archivoTipo'   => $row['archivo_tipo'],
                    'downloadUrl'   => $row['archivo_id']
                        ? $siteUrl . '/?entryPoint=rutasCapacitacionDescargar&id=' . $row['id']
                        : null,
                ];
            }

            return [
                'success' => true,
                'data'    => $lista,
            ];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionCrear($params, $data, $request)
    {
        try {
            $this->checkEsCasaNacional();

            $nombre      = trim((string) ($_POST['nombre'] ?? $request->get('nombre', '')));
            $descripcion = trim((string) ($_POST['descripcion'] ?? $request->get('descripcion', '')));
            $rolesRaw    = (string) ($_POST['roles'] ?? $request->get('roles', ''));

            if ($nombre === '') {
                throw new BadRequest("El nombre es obligatorio");
            }

            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
                throw new BadRequest("No se recibió ningún archivo o hubo un error de subida");
            }

            $file = $_FILES['file'];
            $this->validarArchivo($file);

            $content = file_get_contents($file['tmp_name']);
            $name    = basename($file['name']);
            $type    = $file['type'];

            $attachment = $this->entityManager->getNewEntity('Attachment');
            $attachment->set([
                'name'        => $name,
                'type'        => $type,
                'size'        => $file['size'],
                'role'        => 'Attachment',
                'relatedType' => 'RutasCapacitacionRutas',
                'field'       => 'archivo',
            ]);
            $this->entityManager->saveEntity($attachment);

            $attachmentId = $attachment->getId();
            $rootDir   = dirname(__DIR__, 5);
            $uploadDir = $rootDir . '/data/upload/';

            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0775, true);
            }

            $targetPath = $uploadDir . $attachmentId;
            if (file_put_contents($targetPath, $content) === false) {
                $this->entityManager->removeEntity($attachment);
                throw new BadRequest("No se pudo guardar el archivo");
            }

            $pdo = $this->entityManager->getPDO();
            $sth = $pdo->prepare("SELECT COALESCE(MAX(orden), 0) AS maxOrden FROM rutas_capacitacion_rutas WHERE deleted = 0");
            $sth->execute();
            $maxOrden = (int) $sth->fetch(\PDO::FETCH_ASSOC)['maxOrden'];

            $rolesLimpios = $this->normalizarRoles($rolesRaw);

            $ruta = $this->entityManager->getNewEntity('RutasCapacitacionRutas');
            $ruta->set([
                'nombre'      => $nombre,
                'descripcion' => $descripcion,
                'roles'       => $rolesLimpios,
                'archivoId'   => $attachmentId,
                'orden'       => $maxOrden + 1,
            ]);
            $this->entityManager->saveEntity($ruta);

            $attachment->set('relatedId', $ruta->getId());
            $this->entityManager->saveEntity($attachment);

            $siteUrl = rtrim($this->config->get('siteUrl', ''), '/');

            return [
                'success' => true,
                'ruta' => [
                    'id'            => $ruta->getId(),
                    'nombre'        => $nombre,
                    'descripcion'   => $descripcion,
                    'roles'         => $this->parseRoles($rolesLimpios),
                    'orden'         => $maxOrden + 1,
                    'archivoId'     => $attachmentId,
                    'archivoNombre' => $name,
                    'archivoSize'   => (int) $file['size'],
                    'archivoTipo'   => $type,
                    'downloadUrl'   => $siteUrl . '/?entryPoint=rutasCapacitacionDescargar&id=' . $ruta->getId(),
                ],
            ];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionActualizar($params, $data, $request)
    {
        try {
            $this->checkEsCasaNacional();

            $id          = (string) ($_POST['id'] ?? $request->get('id', ''));
            $nombre      = trim((string) ($_POST['nombre'] ?? $request->get('nombre', '')));
            $descripcion = trim((string) ($_POST['descripcion'] ?? $request->get('descripcion', '')));
            $rolesRaw    = (string) ($_POST['roles'] ?? $request->get('roles', ''));

            if (!$id) {
                throw new BadRequest("ID no proporcionado");
            }

            if ($nombre === '') {
                throw new BadRequest("El nombre es obligatorio");
            }

            $ruta = $this->entityManager->getEntity('RutasCapacitacionRutas', $id);

            if (!$ruta) {
                throw new BadRequest("Documento no encontrado");
            }

            $rolesLimpios = $this->normalizarRoles($rolesRaw);

            $ruta->set([
                'nombre'      => $nombre,
                'descripcion' => $descripcion,
                'roles'       => $rolesLimpios,
            ]);

            // El archivo es opcional al editar: solo se reemplaza si mandaron uno nuevo
            $archivoNuevoId = null;
            $archivoNuevoNombre = null;
            $archivoNuevoTipo = null;
            $archivoNuevoSize = null;

            if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
                $file = $_FILES['file'];
                $this->validarArchivo($file);

                $content = file_get_contents($file['tmp_name']);
                $name    = basename($file['name']);
                $type    = $file['type'];

                $attachment = $this->entityManager->getNewEntity('Attachment');
                $attachment->set([
                    'name'        => $name,
                    'type'        => $type,
                    'size'        => $file['size'],
                    'role'        => 'Attachment',
                    'relatedType' => 'RutasCapacitacionRutas',
                    'field'       => 'archivo',
                    'relatedId'   => $id,
                ]);
                $this->entityManager->saveEntity($attachment);

                $attachmentId = $attachment->getId();
                $rootDir   = dirname(__DIR__, 5);
                $uploadDir = $rootDir . '/data/upload/';

                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0775, true);
                }

                if (file_put_contents($uploadDir . $attachmentId, $content) === false) {
                    $this->entityManager->removeEntity($attachment);
                    throw new BadRequest("No se pudo guardar el archivo");
                }

                // Borrar el attachment viejo para no dejar basura
                $archivoViejoId = $ruta->get('archivoId');
                if ($archivoViejoId) {
                    $attachmentViejo = $this->entityManager->getEntity('Attachment', $archivoViejoId);
                    if ($attachmentViejo) {
                        $this->entityManager->removeEntity($attachmentViejo);
                    }
                }

                $ruta->set('archivoId', $attachmentId);

                $archivoNuevoId = $attachmentId;
                $archivoNuevoNombre = $name;
                $archivoNuevoTipo = $type;
                $archivoNuevoSize = (int) $file['size'];
            }

            $this->entityManager->saveEntity($ruta);

            $siteUrl = rtrim($this->config->get('siteUrl', ''), '/');
            $archivoIdFinal = $archivoNuevoId ?: $ruta->get('archivoId');

            $respuesta = [
                'id'          => $id,
                'nombre'      => $nombre,
                'descripcion' => $descripcion,
                'roles'       => $this->parseRoles($rolesLimpios),
                'downloadUrl' => $archivoIdFinal
                    ? $siteUrl . '/?entryPoint=rutasCapacitacionDescargar&id=' . $id
                    : null,
            ];

            if ($archivoNuevoId) {
                $respuesta['archivoId'] = $archivoNuevoId;
                $respuesta['archivoNombre'] = $archivoNuevoNombre;
                $respuesta['archivoTipo'] = $archivoNuevoTipo;
                $respuesta['archivoSize'] = $archivoNuevoSize;
            }

            return ['success' => true, 'ruta' => $respuesta];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionActualizarOrden($params, $data, $request)
    {
        try {
            $this->checkEsCasaNacional();

            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $orden = $body['orden'] ?? null;
            if (!is_array($orden) || empty($orden)) {
                throw new BadRequest("Lista de orden no proporcionada");
            }

            $pdo = $this->entityManager->getPDO();

            $sth = $pdo->prepare("UPDATE rutas_capacitacion_rutas SET orden = ?, modified_at = NOW() WHERE id = ? AND deleted = 0");

            foreach ($orden as $item) {
                $item = (array) $item;
                if (!isset($item['id']) || !isset($item['orden'])) {
                    continue;
                }
                $sth->execute([(int) $item['orden'], $item['id']]);
            }

            return ['success' => true];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    public function postActionEliminar($params, $data, $request)
    {
        try {
            $this->checkEsCasaNacional();

            $body = $request->getParsedBody();
            if (is_object($body)) $body = (array) $body;

            $rutaId = $body['id'] ?? null;
            if (!$rutaId) {
                throw new BadRequest("ID no proporcionado");
            }

            $ruta = $this->entityManager->getEntity('RutasCapacitacionRutas', $rutaId);

            if (!$ruta) {
                throw new BadRequest("Documento no encontrado");
            }

            $archivoId = $ruta->get('archivoId');

            $this->entityManager->removeEntity($ruta);

            if ($archivoId) {
                $attachment = $this->entityManager->getEntity('Attachment', $archivoId);
                if ($attachment) {
                    $this->entityManager->removeEntity($attachment);
                }
            }

            return ['success' => true];

        } catch (\Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function validarArchivo($file)
    {
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        if (!in_array($extension, $this->extensionesPermitidas)) {
            throw new BadRequest("Tipo de archivo no permitido. Se aceptan: PDF, imágenes, Word, Excel y PowerPoint");
        }

        if (!in_array($file['type'], $this->mimesPermitidos)) {
            throw new BadRequest("Tipo de archivo no permitido. Se aceptan: PDF, imágenes, Word, Excel y PowerPoint");
        }
    }

    // "asesor, Gerente ,coordinador" -> "asesor,gerente,coordinador"
    private function normalizarRoles($rolesRaw)
    {
        $partes = explode(',', $rolesRaw);
        $limpias = [];

        foreach ($partes as $p) {
            $p = strtolower(trim($p));
            if ($p !== '' && !in_array($p, $limpias)) {
                $limpias[] = $p;
            }
        }

        return implode(',', $limpias);
    }

    private function parseRoles($rolesStr)
    {
        if (!$rolesStr) return [];
        return array_values(array_filter(array_map('trim', explode(',', $rolesStr))));
    }

    // Solo admin o rol "casa nacional" pueden subir, editar, ordenar y eliminar
    private function checkEsCasaNacional()
    {
        if ($this->user->isAdmin()) {
            return;
        }

        $pdo = $this->entityManager->getPDO();

        if (!in_array('casa nacional', $this->getRolesUsuario($this->user->get('id'), $pdo))) {
            throw new Forbidden("No tiene permisos para realizar esta acción");
        }
    }

    // Nombres de rol del usuario en minúsculas
    private function getRolesUsuario($userId, $pdo)
    {
        try {
            $sql = "SELECT GROUP_CONCAT(DISTINCT LOWER(r.name)) as roles
                    FROM user u
                    LEFT JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                    LEFT JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                    WHERE u.id = ?
                    AND u.deleted = 0
                    GROUP BY u.id
                    LIMIT 1";

            $sth = $pdo->prepare($sql);
            $sth->execute([$userId]);

            $row = $sth->fetch(\PDO::FETCH_ASSOC);

            return $row && $row['roles'] ? explode(',', $row['roles']) : [];

        } catch (\Exception $e) {
            return [];
        }
    }
}
