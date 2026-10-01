define("rutas-capacitacion:views/documentos-legales-lista", ["view"], function (Dep) {
    return Dep.extend({
        template: "rutas-capacitacion:documentos-legales-lista",

        setup: function () {
            this.documentos = [];
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
                    self.cargarDocumentos();
                })
                .catch(function () {
                    self.renderAcciones();
                    self.cargarDocumentos();
                });
        },

        puedeGestionar: function () {
            return !!(this.permisos.esAdmin || this.permisos.esCasaNacional);
        },

        renderAcciones: function () {
            const contenedor = this.$el.find('#dl-header-actions');
            contenedor.empty();

            if (!this.puedeGestionar()) {
                return;
            }

            const self = this;

            const btnSubir = $('<button class="dl-btn dl-btn-primary" data-action="subir-documento">' +
                '<i class="fas fa-upload"></i> Subir archivo</button>');
            const btnOrganizar = $('<button class="dl-btn dl-btn-secondary" data-action="organizar-documentos">' +
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

            this.createView('modalSubirDocumento', 'rutas-capacitacion:views/modals/subir-documento-legal', {}, function (view) {
                view.render();

                self.listenToOnce(view, 'subida', function () {
                    view.close();
                    Espo.Ui.success('Documento subido correctamente');
                    self.cargarDocumentos();
                });
            });
        },

        abrirModalEditar: function (documento) {
            const self = this;

            this.createView('modalEditarDocumento', 'rutas-capacitacion:views/modals/editar-documento-legal', {
                documento: documento
            }, function (view) {
                view.render();

                self.listenToOnce(view, 'actualizado', function () {
                    view.close();
                    Espo.Ui.success('Documento actualizado correctamente');
                    self.cargarDocumentos();
                });
            });
        },

        abrirModalOrganizar: function () {
            const self = this;

            this.createView('modalOrganizarDocumentos', 'rutas-capacitacion:views/modals/organizar-documentos-legales', {
                documentos: this.documentos
            }, function (view) {
                view.render();

                self.listenToOnce(view, 'actualizado', function () {
                    view.close();
                    self.cargarDocumentos();
                });
            });
        },

        cargarDocumentos: function () {
            if (this.cargando) return;

            this.cargando = true;
            this.mostrarLoading();

            const self = this;

            Espo.Ajax.getRequest("RutasCapacitacionRutas/action/getLista", {tipo: 'legales'})
                .then(function (response) {
                    self.cargando = false;

                    if (response.success) {
                        self.documentos = response.data;
                        self.renderizarLista();
                    } else {
                        self.mostrarError(response.error || "Error al cargar los documentos legales");
                    }
                })
                .catch(function () {
                    self.cargando = false;
                    self.mostrarError("Error de conexión al servidor");
                });
        },

        mostrarLoading: function () {
            this.$el.find('#dl-lista-container').html(`
                <div class="dl-loading">
                    <div class="dl-spinner"></div>
                    <p>Cargando documentos legales...</p>
                </div>
            `);
        },

        mostrarError: function (mensaje) {
            this.$el.find('#dl-lista-container').html(`
                <div class="dl-alert dl-alert-danger">
                    <i class="fas fa-exclamation-circle"></i> ${this.escapeHtml(mensaje)}
                </div>
            `);
        },

        renderizarLista: function () {
            const container = this.$el.find('#dl-lista-container');
            const self = this;

            if (this.documentos.length === 0) {
                container.html(`
                    <div class="dl-no-data">
                        <i class="fas fa-file-contract"></i>
                        <h3>No hay documentos legales disponibles</h3>
                        <p>Aún no hay documentos visibles para tu rol</p>
                    </div>
                `);
                return;
            }

            let html = '<div class="dl-documentos-grid">';

            this.documentos.forEach(function (documento) {
                const icono = self.iconoParaTipo(documento.archivoTipo, documento.archivoNombre);
                const editBtn = self.puedeGestionar()
                    ? `<button class="dl-btn dl-btn-secondary dl-documento-edit-btn" data-id="${documento.id}" title="Editar">
                           <i class="fas fa-pencil-alt"></i>
                       </button>`
                    : '';

                html += `
                    <div class="dl-documento-card" data-id="${documento.id}">
                        <div class="dl-documento-icon" style="background:${icono.bg};color:${icono.color};">
                            <i class="${icono.clase}"></i>
                        </div>
                        <div class="dl-documento-info">
                            <div class="dl-documento-nombre">${self.escapeHtml(documento.nombre)}</div>
                            ${documento.descripcion
                                ? `<div class="dl-documento-descripcion">${self.escapeHtml(documento.descripcion)}</div>`
                                : ''}
                            ${self.puedeGestionar() && documento.roles && documento.roles.length
                                ? `<div class="dl-documento-roles">${documento.roles.map(r =>
                                    `<span class="dl-documento-role-tag">${self.escapeHtml(r)}</span>`).join('')}</div>`
                                : ''}
                        </div>
                        <div class="dl-documento-actions">
                            ${documento.downloadUrl
                                ? `<a href="${documento.downloadUrl}" class="dl-btn dl-btn-primary" target="_blank">
                                       <i class="fas fa-download"></i> Descargar
                                   </a>`
                                : `<span class="dl-documento-sin-archivo">Sin archivo</span>`}
                            ${editBtn}
                        </div>
                    </div>
                `;
            });

            html += '</div>';

            container.html(html);

            container.find('.dl-documento-edit-btn').on('click', function (e) {
                e.preventDefault();
                const id = $(this).data('id');
                const documento = self.documentos.find(function (d) { return d.id === id; });
                if (documento) self.abrirModalEditar(documento);
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
            this.$el.find('#dl-header-actions').off('click');
        }
    });
});
