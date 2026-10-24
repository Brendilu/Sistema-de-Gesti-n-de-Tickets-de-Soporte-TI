/* modulo1_usuarios.js · Gestión de usuarios (solo Administrador)
   GET /api/usuarios · PUT /api/usuarios/:id · PUT /api/usuarios/:id/estado */
let usuarios = [];

function iniciales(nombre) {
    return nombre.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function mostrarError(texto) {
    const el = document.getElementById("msgError");
    el.textContent = texto || "";
    el.classList.toggle("on", !!texto);
}

const barra = document.getElementById("filtros");

function usuariosFiltrados() {
    const f = (n) => valorFiltro(barra, n);
    return usuarios.filter(u =>
        coincide(f("q"), u.nombre, u.email, u.empleado, u.cargo, u.area, u.rol) &&
        (!f("rol") || String(u.rol_id) === f("rol")) &&
        (!f("activo") || (f("activo") === "1") === u.activo) &&
        (!f("vinc") || (f("vinc") === "si") === !!u.empleado_id));
}

function renderUsuarios() {
    const lista = usuariosFiltrados();
    document.getElementById("resumenFiltro").textContent = `Mostrando ${lista.length} de ${usuarios.length} usuarios`;
    let h = "<thead><tr><th>Usuario</th><th>Rol</th><th>Empleado vinculado</th><th>Activo</th><th></th></tr></thead><tbody>";
    lista.forEach(u => {
        h += `<tr>
   <td data-l="Usuario"><div class="who">${distintivo({ nombre: u.nombre, cargo: u.cargo, area: u.area, rol: u.rol }, { mini: true })}<div><b>${esc(u.nombre)}</b><br><small style="color:var(--mu)">${esc(u.email)}</small></div></div></td>
   <td data-l="Rol">${chipRol(u.rol)}</td>
   <td data-l="Empleado">${u.empleado ? distintivo({ nombre: u.empleado, cargo: u.cargo, area: u.area }) + `<br><small class="sub">${esc(codigoEmpleado(u.empleado_id))}</small>` : '<span class="sub">Sin vincular</span>'}</td>
   <td data-l="Activo"><button class="sw ${u.activo ? "on" : ""}" onclick="toggleActivo(${u.id})" aria-label="Activar o desactivar"></button></td>
   <td data-l=""><button class="btn sm" onclick="abrirEditar(${u.id})">Editar</button></td>
  </tr>`;
    });
    if (!lista.length) h += '<tr><td colspan="5" style="text-align:center;color:var(--mu)">Ningún usuario coincide con los filtros.</td></tr>';
    document.getElementById("userTable").innerHTML = h + "</tbody>";
}

async function cargarUsuarios() {
    try {
        usuarios = await api("/api/usuarios");
        renderUsuarios();
    } catch (e) { mostrarError(e.message); }
}

async function toggleActivo(id) {
    const u = usuarios.find(x => x.id === id);
    mostrarError("");
    try {
        await api(`/api/usuarios/${id}/estado`, { method: "PUT", json: { activo: !u.activo } });
        await cargarUsuarios();
    } catch (e) { mostrarError(e.message); }
}

async function abrirEditar(id) {
    const u = usuarios.find(x => x.id === id);
    const cat = await cargarCatalogos();
    llenarSelect(document.getElementById("uRol"), cat.roles, "id", "nombre");
    llenarSelect(document.getElementById("uEmpleado"), cat.empleados, "id",
        e => `${e.nombre_completo}${e.area ? " · " + e.area : ""}`, "— Sin vincular —");
    document.getElementById("uId").value = u.id;
    document.getElementById("uNombre").value = u.nombre;
    document.getElementById("uRol").value = u.rol_id;
    document.getElementById("uEmpleado").value = u.empleado_id || "";
    document.getElementById("uPass").value = "";
    document.getElementById("uError").textContent = "";
    document.getElementById("modalUsuario").hidden = false;
}

function cerrarModal() { document.getElementById("modalUsuario").hidden = true; }

document.getElementById("uCancelar").addEventListener("click", cerrarModal);
document.getElementById("formUsuario").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("uId").value;
    try {
        await api(`/api/usuarios/${id}`, {
            method: "PUT",
            json: {
                nombre: document.getElementById("uNombre").value,
                rol_id: Number(document.getElementById("uRol").value),
                empleado_id: document.getElementById("uEmpleado").value || null,
                password: document.getElementById("uPass").value
            }
        });
        cerrarModal();
        await cargarUsuarios();
    } catch (err) {
        document.getElementById("uError").textContent = err.message;
    }
});

(async function () {
    const cat = await cargarCatalogos();
    llenarSelect(document.getElementById("f-rol"), cat.roles, "id", "nombre", "Todos");
    conectarFiltros(barra, renderUsuarios);
    cargarUsuarios();
})();
