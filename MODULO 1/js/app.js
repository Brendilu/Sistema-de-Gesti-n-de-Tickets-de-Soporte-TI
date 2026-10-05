// Simula la tabla `users`. En el backend real, login y registro llaman a
// /api/auth/login y /api/auth/registro, que devuelven un JWT con el rol embebido.
let users = [
    { id: 1, nombre: "Laura Medina", email: "laura.medina@empresa.com", rol: "Administrador", activo: true },
    { id: 2, nombre: "Ana Ruiz", email: "ana.ruiz@empresa.com", rol: "Técnico", activo: true },
    { id: 3, nombre: "Luis Paz", email: "luis.paz@empresa.com", rol: "Usuario", activo: false }
];

let sesion = null; // null = sin token JWT

function go(v) {
    document.querySelectorAll(".view").forEach(e => e.classList.toggle("on", e.id === "v-" + v));
}

function login() {
    const email = document.getElementById("em").value.trim();
    const pass = document.getElementById("pw").value.trim();
    const user = users.find(u => u.email === email);

    // Simulación del backend: Flask-JWT verificaría el hash bcrypt y devolvería
    // un token firmado con el id y rol del usuario.
    if (user && pass.length > 0) {
        sesion = user;
        document.getElementById("loginError").classList.remove("on");
        renderUsuarios();
        go("usuarios");
    } else {
        document.getElementById("loginError").classList.add("on");
    }
}

function registrar() {
    const nombre = document.getElementById("rn").value.trim();
    const email = document.getElementById("re").value.trim();
    if (!nombre || !email) return;
    users.push({ id: Date.now(), nombre, email, rol: "Usuario", activo: true });
    go("login");
    document.getElementById("em").value = email;
}

function logout() {
    sesion = null;
    go("login");
}

function toggleActivo(id) {
    const u = users.find(x => x.id === id);
    // En el backend: PUT /api/usuarios/:id/estado — protegido con @role_required('admin')
    u.activo = !u.activo;
    renderUsuarios();
}

function iniciales(nombre) {
    return nombre.split(" ").slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

function renderUsuarios() {
    // Guard de ruta: si no hay sesión de administrador, no se muestra el contenido.
    const esAdmin = sesion && sesion.rol === "Administrador";
    document.getElementById("guardMsg").classList.toggle("on", !esAdmin);
    document.getElementById("userTable").style.display = esAdmin ? "" : "none";
    document.getElementById("whoami").textContent = sesion ? `${sesion.nombre} (${sesion.rol})` : "—";

    if (!esAdmin) return;

    let h = "<tr><th>Usuario</th><th>Rol</th><th>Activo</th><th></th></tr>";
    users.forEach(u => {
        h += `<tr>
   <td><div class="who"><span class="av">${iniciales(u.nombre)}</span><div><b>${u.nombre}</b><br><small style="color:var(--mu)">${u.email}</small></div></div></td>
   <td><span class="pill">${u.rol}</span></td>
   <td><button class="sw ${u.activo ? "on" : ""}" onclick="toggleActivo(${u.id})" aria-label="Activar o desactivar"></button></td>
   <td><button class="btn sm">Editar</button></td>
  </tr>`;
    });
    document.getElementById("userTable").innerHTML = h;
}
