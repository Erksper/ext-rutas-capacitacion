define("rutas-capacitacion:views/modals/organizar-rutas", ["views/modal"], function (Dep) {
    return Dep.extend({
        template: "rutas-capacitacion:modals/organizar-rutas",

        cssName: "rc-modal-organizar-rutas",

        header: "Organizar y eliminar rutas",

        backdrop: true,

        huboCambios: false,
        guardando: false,

        setup: function () {
            this.rutas = (this.options.rutas || []).slice().sort(function (a, b) {
                return (a.orden || 0) - (b.orden || 0);
            });

            this.buttonList = [
                {
                    name: "guardarOrden",
                    label: "Guardar orden",
                    style: "primary",
                    onClick: () => this.actionGuardarOrden()
                },
                {
                    name: "cerrar",
                    label: "Cerrar",
                    onClick: () => this.actionCerrar()
                }
            ];
        },

        afterRender: function () {
            this.renderLista();
        },

        renderLista: function () {
            const self = this;
            const $lista = this.$el.find("#rc-organizar-lista");
            const $empty = this.$el.find("#rc-organizar-vacio");

            $lista.empty();

            if (this.rutas.length === 0) {
                $lista.hide();
                $empty.show();
                return;
            }

            $lista.show();
            $empty.hide();

            this.rutas.forEach(function (ruta) {
                const $row = $(`
                    <li class="rc-organizar-row" draggable="true" data-id="${ruta.id}">
                        <i class="fas fa-grip-vertical rc-organizar-handle"></i>
                        <span class="rc-organizar-nombre">${self.escapeHtml(ruta.nombre)}</span>
                        <button type="button" class="rc-organizar-eliminar" title="Eliminar ruta" data-id="${ruta.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </li>
                `);
                $lista.append($row);
            });

            this.attachDragEvents();
            this.attachDeleteEvents();
        },

        attachDragEvents: function () {
            const self = this;
            const container = this.$el.find("#rc-organizar-lista").get(0);

            this.$el.find(".rc-organizar-row").each(function () {
                const row = this;

                row.addEventListener("dragstart", function () {
                    row.classList.add("dragging");
                });

                row.addEventListener("dragend", function () {
                    row.classList.remove("dragging");
                    self.huboCambios = true;
                });
            });

            container.ondragover = function (e) {
                e.preventDefault();
                const dragging = container.querySelector(".dragging");
                if (!dragging) return;

                const afterElement = self.getDragAfterElement(container, e.clientY);
                if (afterElement == null) {
                    container.appendChild(dragging);
                } else {
                    container.insertBefore(dragging, afterElement);
                }
            };
        },

        getDragAfterElement: function (container, y) {
            const rows = [...container.querySelectorAll(".rc-organizar-row:not(.dragging)")];

            return rows.reduce((closest, row) => {
                const box = row.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;

                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: row };
                }

                return closest;
            }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
        },

        attachDeleteEvents: function () {
            const self = this;

            this.$el.find(".rc-organizar-eliminar").on("click", function () {
                const id = $(this).data("id");
                const nombre = self.$el.find('.rc-organizar-row[data-id="' + id + '"] .rc-organizar-nombre').text();

                self.confirmarEliminar(id, nombre);
            });
        },

        confirmarEliminar: function (id, nombre) {
            const self = this;

            if (typeof Espo !== "undefined" && Espo.Ui && Espo.Ui.confirm) {
                Espo.Ui.confirm(
                    '¿Eliminar la ruta "' + nombre + '"? Esta acción no se puede deshacer.',
                    { confirmText: "Eliminar", cancelText: "Cancelar" },
                    function () {
                        self.eliminarRuta(id);
                    }
                );
                return;
            }

            if (window.confirm('¿Eliminar la ruta "' + nombre + '"? Esta acción no se puede deshacer.')) {
                this.eliminarRuta(id);
            }
        },

        eliminarRuta: function (id) {
            const self = this;

            Espo.Ajax.postRequest("RutasCapacitacionRutas/action/eliminar", { id: id })
                .then(function (response) {
                    if (response.success) {
                        self.$el.find('.rc-organizar-row[data-id="' + id + '"]').remove();
                        self.rutas = self.rutas.filter(function (r) { return r.id !== id; });
                        self.huboCambios = true;

                        if (self.rutas.length === 0) {
                            self.$el.find("#rc-organizar-lista").hide();
                            self.$el.find("#rc-organizar-vacio").show();
                        }

                        Espo.Ui.success("Ruta eliminada");
                    } else {
                        Espo.Ui.error(response.error || "No se pudo eliminar la ruta");
                    }
                })
                .catch(function () {
                    Espo.Ui.error("Error de conexión al eliminar la ruta");
                });
        },

        actionGuardarOrden: function () {
            if (this.guardando) return;

            const self = this;
            const orden = [];

            this.$el.find(".rc-organizar-row").each(function (index) {
                orden.push({
                    id: $(this).data("id"),
                    orden: index + 1
                });
            });

            if (orden.length === 0) {
                this.close();
                return;
            }

            this.guardando = true;
            this.disableButton("guardarOrden");

            Espo.Ajax.postRequest("RutasCapacitacionRutas/action/actualizarOrden", { orden: orden })
                .then(function (response) {
                    self.guardando = false;
                    self.enableButton("guardarOrden");

                    if (response.success) {
                        Espo.Ui.success("Orden guardado correctamente");
                        self.trigger("actualizado");
                    } else {
                        Espo.Ui.error(response.error || "No se pudo guardar el orden");
                    }
                })
                .catch(function () {
                    self.guardando = false;
                    self.enableButton("guardarOrden");
                    Espo.Ui.error("Error de conexión al guardar el orden");
                });
        },

        actionCerrar: function () {
            if (this.huboCambios) {
                this.trigger("actualizado");
                return;
            }

            this.close();
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
