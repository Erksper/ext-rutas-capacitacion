define("rutas-capacitacion:controllers/rutas-capacitacion-lista", [
    "controllers/base",
], function (Base) {
    return Base.extend({
        checkAccess: function () {
            return true;
        },

        defaultAction: "index",

        actionIndex: function (options) {
            this.main("rutas-capacitacion:views/rutas-capacitacion-lista", {});
        }
    });
});
