<!-- client/custom/modules/rutas-capacitacion/res/templates/modals/editar-documento-legal.tpl -->
<link rel="stylesheet" type="text/css" href="client/custom/modules/rutas-capacitacion/res/css/documentos-legales.css">

<div class="dl-modal-form">
    <div class="form-group">
        <label for="dl-documento-nombre">Nombre <span class="text-danger">*</span></label>
        <input type="text" class="form-control" id="dl-documento-nombre" maxlength="255">
    </div>

    <div class="form-group">
        <label for="dl-documento-descripcion">Descripción</label>
        <textarea class="form-control" id="dl-documento-descripcion" rows="3"></textarea>
    </div>

    <div class="form-group">
        <label for="dl-documento-file">Reemplazar archivo (opcional)</label>
        <div id="dl-documento-archivo-actual" class="dl-file-name"></div>
        <input type="file" id="dl-documento-file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx" class="form-control">
        <div id="dl-documento-file-name" class="dl-file-name"></div>
    </div>

    <div class="form-group">
        <label>Roles con acceso <span class="text-danger">*</span></label>
        <div class="dl-roles-selector-header">
            <span></span>
            <button type="button" class="dl-btn-link" id="dl-documento-roles-toggle-todos">Seleccionar / deseleccionar todos</button>
        </div>
        <div id="dl-documento-roles-lista" class="dl-roles-selector-lista">
            <div class="dl-loading">
                <div class="dl-spinner"></div>
                <p>Cargando roles...</p>
            </div>
        </div>
    </div>
</div>
