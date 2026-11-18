// =====================================================================
//  FUNCIONES DE APOYO (se usan en login.js y en app.js)
// =====================================================================

// Muestra un aviso de Bootstrap (verde = éxito, rojo = error, etc.)
// tipo: "success" | "danger" | "warning" | "info"
function mostrarMensaje(texto, tipo = "info") {
    const contenedor = document.getElementById("mensaje");
    const alerta = document.createElement("div");
    alerta.className = `alert alert-${tipo} alert-dismissible fade show shadow-sm`;
    alerta.setAttribute("role", "alert");
    alerta.innerHTML = `${escaparHTML(texto)}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>`;
    contenedor.appendChild(alerta);

    // El aviso se cierra solo después de 5 segundos
    setTimeout(() => bootstrap.Alert.getOrCreateInstance(alerta).close(), 5000);
}

// Convierte los mensajes de error de Supabase (en inglés) a español
function traducirError(error) {
    const mensaje = (error && error.message) ? error.message : String(error);

    if (mensaje.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
    if (mensaje.includes("Email not confirmed")) return "Primero confirma tu correo (revisa tu bandeja de entrada).";
    if (mensaje.includes("User already registered")) return "Ese correo ya tiene una cuenta. Inicia sesión.";
    if (mensaje.includes("Password should be")) return "La contraseña debe tener al menos 6 caracteres.";
    if (mensaje.includes("Failed to fetch")) return "No hay conexión con el servidor. Revisa tu internet.";
    if (mensaje.includes("maximum allowed size")) return "El archivo es demasiado grande (máximo 10 MB).";
    if (mensaje.includes("mime type")) return "Tipo de archivo no permitido. Usa PDF, JPG, PNG o WEBP.";
    if (mensaje.includes("row-level security")) return "No tienes permiso para esta acción.";
    return mensaje;
}

// Evita que un texto escrito por el usuario se interprete como HTML
function escaparHTML(texto) {
    const div = document.createElement("div");
    div.textContent = texto ?? "";
    return div.innerHTML;
}

// Activa / desactiva un botón mostrando un spinner mientras espera
function botonCargando(boton, cargando, textoCargando = "Procesando...") {
    if (cargando) {
        boton.dataset.textoOriginal = boton.innerHTML;
        boton.innerHTML = `<span class="spinner-border spinner-border-sm me-1"></span>${textoCargando}`;
        boton.disabled = true;
    } else {
        boton.innerHTML = boton.dataset.textoOriginal;
        boton.disabled = false;
    }
}
