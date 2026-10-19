/* modulo1_login.js · Login y registro (POST /api/auth/login, POST /api/auth/registro) */
function go(v) {
    document.querySelectorAll(".view").forEach(e => e.classList.toggle("on", e.id === "v-" + v));
}

function mostrar(id, texto) {
    const el = document.getElementById(id);
    if (texto) el.textContent = texto;
    el.classList.toggle("on", !!texto);
}

document.getElementById("formLogin").addEventListener("submit", async (e) => {
    e.preventDefault();
    mostrar("loginOk", ""); mostrar("loginError", "");
    try {
        const r = await api("/api/auth/login", {
            method: "POST",
            json: { email: document.getElementById("em").value, password: document.getElementById("pw").value }
        });
        location.href = r.redirect;
    } catch (err) {
        mostrar("loginError", err.message);
    }
});

document.getElementById("formRegistro").addEventListener("submit", async (e) => {
    e.preventDefault();
    mostrar("regError", "");
    const email = document.getElementById("re").value.trim();
    try {
        const r = await api("/api/auth/registro", {
            method: "POST",
            json: {
                empresa: document.getElementById("rc").value,
                nombre: document.getElementById("rn").value,
                email: email,
                password: document.getElementById("rp").value
            }
        });
        document.getElementById("formRegistro").reset();
        document.getElementById("em").value = email;
        mostrar("loginOk", r.mensaje);
        go("login");
    } catch (err) {
        mostrar("regError", err.message);
    }
});
