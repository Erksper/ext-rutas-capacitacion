define("rutas-capacitacion:views/modals/editar-documento-legal", ["views/modal"], function (Dep) {
    return Dep.extend({
        template: "rutas-capacitacion:modals/editar-documento-legal",

        cssName: "dl-modal-editar-documento",

        header: "Editar documento",

        backdrop: true,

        guardando: false,
        rolesDisponibles: [],

        setup: function () {
            this.documento = this.options.documento || {};
            this.rolesActuales = this.documento.roles || [];

            this.buttonList = [
                {
                    name: "guardar",
                    label: "Guardar cambios",
                    style: "primary",
                    onClick: () => this.actionGuardar()
                },
                {
                    name: "cancel",
                    label: "Cancelar",
                    onClick: () => this.close()
                }
            ];
        },

        afterRender: function () {
            const self = this;

            this.$el.find("#dl-documento-nombre").val(this.documento.nombre || "");
            this.$el.find("#dl-documento-descripcion").val(this.documento.descripcion || "");

            if (this.documento.archivoNombre) {
                this.$el.find("#dl-documento-archivo-actual").text("Archivo actual: " + this.documento.archivoNombre);
            }

            this.$el.find("#dl-documento-file").on("change", function () {
                const file = this.files && this.files[0];
                const nombreEl = self.$el.find("#dl-documento-file-name");
                nombreEl.text(file ? file.name : "");
            });

            this.$el.find("#dl-documento-roles-toggle-todos").on("click", function () {
                self.toggleTodosLosRoles();
            });

            this.cargarRoles();
        },

        cargarRoles: function () {
            const self = this;
            const $lista = this.$el.find("#dl-documento-roles-lista");

            Espo.Ajax.getRequest("RutasCapacitacionRutas/action/getRolesDisponibles")
                .then(function (response) {
                    if (!response.success) {
                        $lista.html('<div class="dl-alert dl-alert-danger">' +
                            self.escapeHtml(response.error || 'No se pudieron cargar los roles') + '</div>');
                        return;
                    }

                    self.rolesDisponibles = response.data;
                    self.renderRoles();
                })
                .catch(function () {
                    $lista.html('<div class="dl-alert dl-alert-danger">Error de conexión</div>');
                });
        },

        renderRoles: function () {
            const self = this;
            const $lista = this.$el.find("#dl-documento-roles-lista");

            if (this.rolesDisponibles.length === 0) {
                $lista.html('<p class="dl-empty-text">No hay roles configurados en el sistema</p>');
                return;
            }

            let html = '';
            this.rolesDisponibles.forEach(function (rol) {
                const checked = self.rolesActuales.indexOf(rol.name) !== -1 ? 'checked' : '';
                html += `
                    <label class="dl-rol-check-row">
                        <input type="checkbox" class="dl-documento-rol-checkbox" value="${self.escapeHtml(rol.name)}" ${checked}>
                        <span>${self.escapeHtml(rol.name)}</span>
                    </label>
                `;
            });

            $lista.html(html);
        },

        toggleTodosLosRoles: function () {
            const $checks = this.$el.find(".dl-documento-rol-checkbox");
            const todosMarcados = $checks.length > 0 && $checks.filter(':checked').length === $checks.length;
            $checks.prop('checked', !todosMarcados);
        },

        actionGuardar: function () {
            if (this.guardando) return;

            const nombre = (this.$el.find("#dl-documento-nombre").val() || "").trim();
            const descripcion = (this.$el.find("#dl-documento-descripcion").val() || "").trim();
            const fileInput = this.$el.find("#dl-documento-file").get(0);
            const file = fileInput && fileInput.files && fileInput.files[0];

            const roles = this.$el.find(".dl-documento-rol-checkbox:checked")
                .map(function () { return $(this).val(); }).get();

            if (!nombre) {
                Espo.Ui.error("El nombre es obligatorio");
                return;
            }

            if (roles.length === 0) {
                Espo.Ui.error("Selecciona al menos un rol que pueda ver este documento");
                return;
            }

            this.guardarCambios(nombre, descripcion, file, roles);
        },

        guardarCambios: function (nombre, descripcion, file, roles) {
            const self = this;

            this.guardando = true;
            this.disableButton("guardar");
            Espo.Ui.notify("Guardando cambios...");

            const formData = new FormData();
            formData.append("id", this.documento.id);
            formData.append("nombre", nombre);
            formData.append("descripcion", descripcion);
            formData.append("roles", roles.join(","));
            if (file) {
                formData.append("file", file);
            }

            const xhr = new XMLHttpRequest();
            xhr.open("POST", "api/v1/RutasCapacitacionRutas/action/actualizar", true);

            const token = (typeof Espo !== "undefined" && Espo.Ajax && Espo.Ajax.getCsrfToken)
                ? Espo.Ajax.getCsrfToken() : null;
            if (token) xhr.setRequestHeader("X-Csrf-Token", token);

            xhr.onload = function () {
                self.guardando = false;
                self.enableButton("guardar");

                let response;
                try {
                    response = JSON.parse(xhr.responseText);
                } catch (e) {
                    Espo.Ui.error("Error al procesar la respuesta del servidor");
                    return;
                }

                if (response.success) {
                    self.trigger("actualizado", response.ruta);
                } else {
                    Espo.Ui.error(response.error || "Error al guardar los cambios");
                }
            };

            xhr.onerror = function () {
                self.guardando = false;
                self.enableButton("guardar");
                Espo.Ui.error("Error de conexión al guardar los cambios");
            };

            xhr.send(formData);
        },

        disableButton: function (name) {
            this.$el.find('button[data-name="' + name + '"]').addClass("disabled").attr("disabled", "disabled");
        },

        enableButton: function (name) {
            this.$el.find('button[data-name="' + name + '"]').removeClass("disabled").removeAttr("disabled");
        },

        escapeHtml: function (text) {
            if (!text) return "";
            const div = document.createElement("div");
            div.textContent = text;
            return div.innerHTML;
        }
    });
});
