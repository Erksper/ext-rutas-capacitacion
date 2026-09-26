<!-- client/custom/modules/rutas-capacitacion/res/templates/modals/editar-ruta.tpl -->
<link rel="stylesheet" type="text/css" href="client/custom/modules/rutas-capacitacion/res/css/rutas-capacitacion.css">

<div class="rc-modal-form">
    <div class="form-group">
        <label for="rc-ruta-nombre">Nombre <span class="text-danger">*</span></label>
        <input type="text" class="form-control" id="rc-ruta-nombre" maxlength="255">
    </div>

    <div class="form-group">
        <label for="rc-ruta-descripcion">Descripción</label>
        <textarea class="form-control" id="rc-ruta-descripcion" rows="3"></textarea>
    </div>

    <div class="form-group">
        <label for="rc-ruta-file">Reemplazar archivo (opcional)</label>
        <div id="rc-ruta-archivo-actual" class="rc-file-name"></div>
        <input type="file" id="rc-ruta-file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx" class="form-control">
        <div id="rc-ruta-file-name" class="rc-file-name"></div>
    </div>

    <div class="form-group">
        <label>Roles con acceso <span class="text-danger">*</span></label>
        <div class="rc-roles-selector-header">
            <span></span>
            <button type="button" class="rc-btn-link" id="rc-ruta-roles-toggle-todos">Seleccionar / deseleccionar todos</button>
        </div>
        <div id="rc-ruta-roles-lista" class="rc-roles-selector-lista">
            <div class="rc-loading">
                <div class="rc-spinner"></div>
                <p>Cargando roles...</p>
            </div>
        </div>
    </div>
</div>
