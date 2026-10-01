define("rutas-capacitacion:controllers/documentos-legales-lista", [
    "controllers/base",
], function (Base) {
    return Base.extend({
        checkAccess: function () {
            return true;
        },

        defaultAction: "index",

        actionIndex: function (options) {
            this.main("rutas-capacitacion:views/documentos-legales-lista", {});
        }
    });
});
