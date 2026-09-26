define("rutas-capacitacion:views/rutas-capacitacion-lista", ["view"], function (Dep) {
    return Dep.extend({
        template: "rutas-capacitacion:rutas-capacitacion-lista",

        setup: function () {
            this.rutas = [];
            this.permisos = {
                esAdmin: false,
                esCasaNacional: false
            };
            this.cargando = false;
        },

        afterRender: function () {
            this.cargarPermisos();
        },

        cargarPermisos: function () {
            const self = this;

            Espo.Ajax.getRequest("RutasCapacitacionRutas/action/getUserInfo")
                .then(function (response) {
                    if (response.success && response.data) {
                        self.permisos = {
                            esAdmin: response.data.esAdmin,
                            esCasaNacional: response.data.esCasaNacional
                        };
                    }
                    self.renderAcciones();
                    self.cargarRutas();
                })
                .catch(function () {
                    self.renderAcciones();
                    self.cargarRutas();
                });
        },

        puedeGestionar: function () {
            return !!(this.permisos.esAdmin || this.permisos.esCasaNacional);
        },

        renderAcciones: function () {
            const contenedor = this.$el.find('#rc-header-actions');
            contenedor.empty();

            if (!this.puedeGestionar()) {
                return;
            }

            const self = this;

            const btnSubir = $('<button class="rc-btn rc-btn-primary" data-action="subir-ruta">' +
                '<i class="fas fa-upload"></i> Subir archivo</button>');
            const btnOrganizar = $('<button class="rc-btn rc-btn-secondary" data-action="organizar-rutas">' +
                '<i class="fas fa-sort"></i> Organizar / Eliminar</button>');

            btnSubir.on('click', function () {
                self.abrirModalSubir();
            });
            btnOrganizar.on('click', function () {
                self.abrirModalOrganizar();
            });

            contenedor.append(btnSubir).append(btnOrganizar);
        },

        abrirModalSubir: function () {
            const self = this;

            this.createView('modalSubirRuta', 'rutas-capacitacion:views/modals/subir-ruta', {}, function (view) {
                view.render();

                self.listenToOnce(view, 'subida', function () {
                    view.close();
                    Espo.Ui.success('Ruta subida correctamente');
                    self.cargarRutas();
                });
            });
        },

        abrirModalEditar: function (ruta) {
            const self = this;

            this.createView('modalEditarRuta', 'rutas-capacitacion:views/modals/editar-ruta', {
                ruta: ruta
            }, function (view) {
                view.render();

                self.listenToOnce(view, 'actualizado', function () {
                    view.close();
                    Espo.Ui.success('Ruta actualizada correctamente');
                    self.cargarRutas();
                });
            });
        },

        abrirModalOrganizar: function () {
            const self = this;

            this.createView('modalOrganizarRutas', 'rutas-capacitacion:views/modals/organizar-rutas', {
                rutas: this.rutas
            }, function (view) {
                view.render();

                self.listenToOnce(view, 'actualizado', function () {
                    view.close();
                    self.cargarRutas();
                });
            });
        },

        cargarRutas: function () {
            if (this.cargando) return;

            this.cargando = true;
            this.mostrarLoading();

            const self = this;

            Espo.Ajax.getRequest("RutasCapacitacionRutas/action/getLista")
                .then(function (response) {
                    self.cargando = false;

                    if (response.success) {
                        self.rutas = response.data;
                        self.renderizarLista();
                    } else {
                        self.mostrarError(response.error || "Error al cargar las rutas de capacitación");
                    }
                })
                .catch(function () {
                    self.cargando = false;
                    self.mostrarError("Error de conexión al servidor");
                });
        },

        mostrarLoading: function () {
            this.$el.find('#rc-lista-container').html(`
                <div class="rc-loading">
                    <div class="rc-spinner"></div>
                    <p>Cargando rutas de capacitación...</p>
                </div>
            `);
        },

        mostrarError: function (mensaje) {
            this.$el.find('#rc-lista-container').html(`
                <div class="rc-alert rc-alert-danger">
                    <i class="fas fa-exclamation-circle"></i> ${this.escapeHtml(mensaje)}
                </div>
            `);
        },

        renderizarLista: function () {
            const container = this.$el.find('#rc-lista-container');
            const self = this;

            if (this.rutas.length === 0) {
                container.html(`
                    <div class="rc-no-data">
                        <i class="fas fa-graduation-cap"></i>
                        <h3>No hay rutas de capacitación disponibles</h3>
                        <p>Aún no hay documentos visibles para tu rol</p>
                    </div>
                `);
                return;
            }

            let html = '<div class="rc-rutas-grid">';

            this.rutas.forEach(function (ruta) {
                const icono = self.iconoParaTipo(ruta.archivoTipo, ruta.archivoNombre);
                const editBtn = self.puedeGestionar()
                    ? `<button class="rc-btn rc-btn-secondary rc-ruta-edit-btn" data-id="${ruta.id}" title="Editar">
                           <i class="fas fa-pencil-alt"></i>
                       </button>`
                    : '';

                html += `
                    <div class="rc-ruta-card" data-id="${ruta.id}">
                        <div class="rc-ruta-icon" style="background:${icono.bg};color:${icono.color};">
                            <i class="${icono.clase}"></i>
                        </div>
                        <div class="rc-ruta-info">
                            <div class="rc-ruta-nombre">${self.escapeHtml(ruta.nombre)}</div>
                            ${ruta.descripcion
                                ? `<div class="rc-ruta-descripcion">${self.escapeHtml(ruta.descripcion)}</div>`
                                : ''}
                            ${self.puedeGestionar() && ruta.roles && ruta.roles.length
                                ? `<div class="rc-ruta-roles">${ruta.roles.map(r =>
                                    `<span class="rc-ruta-role-tag">${self.escapeHtml(r)}</span>`).join('')}</div>`
                                : ''}
                        </div>
                        <div class="rc-ruta-actions">
                            ${ruta.downloadUrl
                                ? `<a href="${ruta.downloadUrl}" class="rc-btn rc-btn-primary" target="_blank">
                                       <i class="fas fa-download"></i> Descargar
                                   </a>`
                                : `<span class="rc-ruta-sin-archivo">Sin archivo</span>`}
                            ${editBtn}
                        </div>
                    </div>
                `;
            });

            html += '</div>';

            container.html(html);

            container.find('.rc-ruta-edit-btn').on('click', function (e) {
                e.preventDefault();
                const id = $(this).data('id');
                const ruta = self.rutas.find(function (r) { return r.id === id; });
                if (ruta) self.abrirModalEditar(ruta);
            });
        },

        iconoParaTipo: function (mime, nombre) {
            const ext = (nombre || '').split('.').pop().toLowerCase();

            if (mime === 'application/pdf' || ext === 'pdf') {
                return { clase: 'fas fa-file-pdf', bg: '#FDECEA', color: '#E74C3C' };
            }
            if ((mime && mime.indexOf('image/') === 0) || ['jpg','jpeg','png','gif','webp'].indexOf(ext) !== -1) {
                return { clase: 'fas fa-file-image', bg: '#EAF4FD', color: '#3498DB' };
            }
            if (ext === 'doc' || ext === 'docx' || (mime && mime.indexOf('word') !== -1)) {
                return { clase: 'fas fa-file-word', bg: '#EAF1FB', color: '#2E5FA3' };
            }
            if (ext === 'xls' || ext === 'xlsx' || (mime && mime.indexOf('sheet') !== -1) || (mime && mime.indexOf('excel') !== -1)) {
                return { clase: 'fas fa-file-excel', bg: '#EAFBF0', color: '#27AE60' };
            }
            if (ext === 'ppt' || ext === 'pptx' || (mime && mime.indexOf('presentation') !== -1) || (mime && mime.indexOf('powerpoint') !== -1)) {
                return { clase: 'fas fa-file-powerpoint', bg: '#FDF2EA', color: '#D35400' };
            }

            return { clase: 'fas fa-file', bg: '#F0F0F0', color: '#666' };
        },

        escapeHtml: function (text) {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        onRemove: function () {
            this.$el.find('#rc-header-actions').off('click');
        }
    });
});
