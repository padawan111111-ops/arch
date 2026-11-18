// =====================================================================
//  LOGIN.JS  ·  Inicio de sesión y registro
// =====================================================================

const formLogin = document.getElementById("form-login");
const formRegistro = document.getElementById("form-registro");

// ---------------------------------------------------------------------
// 1. SESIÓN PREVIA
//    Si el usuario ya inició sesión antes, Supabase guardó su sesión en
//    el navegador. La leemos y, si existe, entramos directo a la app
//    sin pedir correo y contraseña otra vez.
// ---------------------------------------------------------------------
async function verificarSesionPrevia() {
    try {
        const { data, error } = await clienteSupabase.auth.getSession();
        if (error) throw error;

        if (data.session) {
            window.location.replace("app.html");
        }
    } catch (error) {
        mostrarMensaje(traducirError(error), "danger");
    }
}

// ---------------------------------------------------------------------
// 2. INICIAR SESIÓN con correo y contraseña
// ---------------------------------------------------------------------
async function iniciarSesion(evento) {
    evento.preventDefault(); // evita que el formulario recargue la página

    const correo = document.getElementById("login-correo").value.trim();
    const password = document.getElementById("login-password").value;
    const boton = document.getElementById("btn-login");

    botonCargando(boton, true, "Entrando...");
    try {
        // Petición al servidor de Supabase (esperamos la respuesta con await)
        const { error } = await clienteSupabase.auth.signInWithPassword({
            email: correo,
            password: password
        });
        if (error) throw error;

        window.location.replace("app.html");
    } catch (error) {
        mostrarMensaje(traducirError(error), "danger");
        botonCargando(boton, false);
    }
}

// ---------------------------------------------------------------------
// 3. CREAR CUENTA nueva
// ---------------------------------------------------------------------
async function crearCuenta(evento) {
    evento.preventDefault();

    const correo = document.getElementById("registro-correo").value.trim();
    const password = document.getElementById("registro-password").value;
    const boton = document.getElementById("btn-registro");

    botonCargando(boton, true, "Creando cuenta...");
    try {
        const { data, error } = await clienteSupabase.auth.signUp({
            email: correo,
            password: password
        });
        if (error) throw error;

        if (data.session) {
            // La confirmación por correo está desactivada: entra directo
            window.location.replace("app.html");
        } else {
            // Supabase pide confirmar el correo antes de entrar
            mostrarMensaje("Cuenta creada. Revisa tu correo para confirmarla y luego inicia sesión.", "success");
            formRegistro.reset();
        }
    } catch (error) {
        mostrarMensaje(traducirError(error), "danger");
    } finally {
        botonCargando(boton, false);
    }
}

// Eventos
formLogin.addEventListener("submit", iniciarSesion);
formRegistro.addEventListener("submit", crearCuenta);

// Al abrir la página revisamos si ya había sesión
verificarSesionPrevia();
