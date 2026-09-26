<?php
namespace Espo\Modules\RutasCapacitacion\EntryPoints;

use Espo\Core\Api\Request;
use Espo\Core\Api\Response;
use Espo\Core\EntryPoint\EntryPoint;
use Espo\Core\ORM\EntityManager;
use Espo\Entities\User;

// IMPORTANTE: a propósito NO usa el trait NoAuth — requiere sesión iniciada,
// porque necesitamos saber quién es el usuario para poder aplicar el filtro
// por rol (igual que en RutasCapacitacionRutas::getActionGetLista). El entryPoint
// nativo "?entryPoint=download" de Espo no sirve acá por dos motivos:
//   1) RutasCapacitacionRutas tiene "acl": false en su scope (nadie fuera de admin
//      pasa el check de ACL estándar de Espo -> 403 para usuarios regulares).
//   2) Aunque se le diera ACL de lectura completa a todos, ese ACL es
//      todo-o-nada a nivel de entidad: no conoce el campo "roles" de cada
//      documento, así que cualquiera con el id del archivo podría descargar
//      documentos que no le corresponden por rol.
class RutasCapacitacionDescargar implements EntryPoint
{
    public function __construct(
        private EntityManager $entityManager,
        private User $user
    ) {}

    public function run(Request $request, Response $response): void
    {
        $id = $request->getQueryParam('id');

        if (!$id) {
            $response->setStatus(400);
            return;
        }

        $ruta = $this->entityManager->getEntity('RutasCapacitacionRutas', $id);

        if (!$ruta || $ruta->get('deleted')) {
            $response->setStatus(404);
            return;
        }

        if (!$this->tieneAcceso($ruta)) {
            $response->setStatus(403);
            return;
        }

        $attachmentId = $ruta->get('archivoId');

        if (!$attachmentId) {
            $response->setStatus(404);
            return;
        }

        $attachment = $this->entityManager->getEntity('Attachment', $attachmentId);

        if (!$attachment) {
            $response->setStatus(404);
            return;
        }

        $rootDir  = dirname(__DIR__, 5);
        $filePath = $rootDir . '/data/upload/' . $attachmentId;

        if (!file_exists($filePath)) {
            $response->setStatus(404);
            return;
        }

        $nombreArchivo = $attachment->get('name') ?: 'archivo';
        $tipoArchivo   = $attachment->get('type') ?: 'application/octet-stream';

        $response->setHeader('Content-Type', $tipoArchivo);
        $response->setHeader(
            'Content-Disposition',
            'attachment; filename="' . str_replace('"', '', $nombreArchivo) . '"'
        );
        $response->setHeader('Content-Length', (string) filesize($filePath));
        $response->setHeader('Cache-Control', 'private, max-age=0');

        $response->writeBody(file_get_contents($filePath));
    }

    private function tieneAcceso($ruta): bool
    {
        if ($this->user->isAdmin()) {
            return true;
        }

        $pdo = $this->entityManager->getPDO();

        $sql = "SELECT GROUP_CONCAT(DISTINCT LOWER(r.name)) as roles
                FROM user u
                LEFT JOIN role_user ru ON u.id = ru.user_id AND ru.deleted = 0
                LEFT JOIN role r ON ru.role_id = r.id AND r.deleted = 0
                WHERE u.id = ? AND u.deleted = 0
                GROUP BY u.id
                LIMIT 1";

        $sth = $pdo->prepare($sql);
        $sth->execute([$this->user->getId()]);
        $row = $sth->fetch(\PDO::FETCH_ASSOC);

        $rolesUsuario = $row && $row['roles'] ? explode(',', $row['roles']) : [];

        if (in_array('casa nacional', $rolesUsuario)) {
            return true;
        }

        $rolesRaw = (string) $ruta->get('roles');
        $rolesDoc = $rolesRaw
            ? array_values(array_filter(array_map('trim', explode(',', $rolesRaw))))
            : [];

        foreach ($rolesDoc as $rolDoc) {
            if (in_array($rolDoc, $rolesUsuario)) {
                return true;
            }
        }

        return false;
    }
}
