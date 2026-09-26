define("rutas-capacitacion:views/modals/subir-ruta", ["views/modal"], function (Dep) {
    return Dep.extend({
        template: "rutas-capacitacion:modals/subir-ruta",

        cssName: "rc-modal-subir-ruta",

        header: "Subir nueva ruta",

        backdrop: true,

        subiendo: false,
        rolesDisponibles: [],

        setup: function () {
            this.buttonList = [
                {
                    name: "guardar",
                    label: "Guardar",
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

            this.$el.find("#rc-ruta-file").on("change", function () {
                const file = this.files && this.files[0];
                const nombreEl = self.$el.find("#rc-ruta-file-name");

                if (!file) {
                    nombreEl.text("");
                    return;
                }

                nombreEl.text(file.name);
            });

            this.$el.find("#rc-ruta-roles-toggle-todos").on("click", function () {
                self.toggleTodosLosRoles();
            });

            this.cargarRoles();
        },

        cargarRoles: function () {
            const self = this;
            const $lista = this.$el.find("#rc-ruta-roles-lista");

            Espo.Ajax.getRequest("RutasCapacitacionRutas/action/getRolesDisponibles")
                .then(function (response) {
                    if (!response.success) {
                        $lista.html('<div class="rc-alert rc-alert-danger">' +
                            self.escapeHtml(response.error || 'No se pudieron cargar los roles') + '</div>');
                        return;
                    }

                    self.rolesDisponibles = response.data;
                    self.renderRoles();
                })
                .catch(function () {
                    $lista.html('<div class="rc-alert rc-alert-danger">Error de conexión</div>');
                });
        },

        renderRoles: function () {
            const self = this;
            const $lista = this.$el.find("#rc-ruta-roles-lista");

            if (this.rolesDisponibles.length === 0) {
                $lista.html('<p class="rc-empty-text">No hay roles configurados en el sistema</p>');
                return;
            }

            let html = '';
            this.rolesDisponibles.forEach(function (rol) {
                html += `
                    <label class="rc-rol-check-row">
                        <input type="checkbox" class="rc-ruta-rol-checkbox" value="${self.escapeHtml(rol.name)}">
                        <span>${self.escapeHtml(rol.name)}</span>
                    </label>
                `;
            });

            $lista.html(html);
        },

        toggleTodosLosRoles: function () {
            const $checks = this.$el.find(".rc-ruta-rol-checkbox");
            const todosMarcados = $checks.length > 0 && $checks.filter(':checked').length === $checks.length;
            $checks.prop('checked', !todosMarcados);
        },

        actionGuardar: function () {
            if (this.subiendo) return;

            const nombre = (this.$el.find("#rc-ruta-nombre").val() || "").trim();
            const descripcion = (this.$el.find("#rc-ruta-descripcion").val() || "").trim();
            const fileInput = this.$el.find("#rc-ruta-file").get(0);
            const file = fileInput && fileInput.files && fileInput.files[0];

            const roles = this.$el.find(".rc-ruta-rol-checkbox:checked")
                .map(function () { return $(this).val(); }).get();

            if (!nombre) {
                Espo.Ui.error("El nombre es obligatorio");
                return;
            }

            if (!file) {
                Espo.Ui.error("Debes seleccionar un archivo");
                return;
            }

            if (roles.length === 0) {
                Espo.Ui.error("Selecciona al menos un rol que pueda ver este documento");
                return;
            }

            this.subirArchivo(nombre, descripcion, file, roles);
        },

        subirArchivo: function (nombre, descripcion, file, roles) {
            const self = this;

            this.subiendo = true;
            this.disableButton("guardar");
            Espo.Ui.notify("Subiendo ruta...");

            const formData = new FormData();
            formData.append("file", file);
            formData.append("nombre", nombre);
            formData.append("descripcion", descripcion);
            formData.append("roles", roles.join(","));

            const xhr = new XMLHttpRequest();
            xhr.open("POST", "api/v1/RutasCapacitacionRutas/action/crear", true);

            const token = (typeof Espo !== "undefined" && Espo.Ajax && Espo.Ajax.getCsrfToken)
                ? Espo.Ajax.getCsrfToken() : null;
            if (token) xhr.setRequestHeader("X-Csrf-Token", token);

            xhr.onload = function () {
                self.subiendo = false;
                self.enableButton("guardar");

                let response;
                try {
                    response = JSON.parse(xhr.responseText);
                } catch (e) {
                    Espo.Ui.error("Error al procesar la respuesta del servidor");
                    return;
                }

                if (response.success) {
                    self.trigger("subida", response.ruta);
                } else {
                    Espo.Ui.error(response.error || "Error al subir la ruta");
                }
            };

            xhr.onerror = function () {
                self.subiendo = false;
                self.enableButton("guardar");
                Espo.Ui.error("Error de conexión al subir la ruta");
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
