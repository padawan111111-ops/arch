// =====================================================================
//  APP.JS  ·  Página principal: sesión, documentos y archivos
// =====================================================================

// ---------------------------------------------------------------------
// DATOS FIJOS
// ---------------------------------------------------------------------
const CARPETAS = [
    { nombre: "Documentos Privados", icono: "bi-shield-lock" },
    { nombre: "Cursos de Actualización", icono: "bi-award" },
    { nombre: "Documentos Académicos", icono: "bi-mortarboard" },
    { nombre: "Documentos Familiares", icono: "bi-house-heart" }
];

// Cada tipo de documento tiene una carpeta sugerida y un ícono
const TIPOS = [
    { nombre: "INE", carpeta: "Documentos Privados", icono: "bi-person-vcard" },
    { nombre: "CURP", carpeta: "Documentos Privados", icono: "bi-card-text" },
    { nombre: "Acta de nacimiento", carpeta: "Documentos Privados", icono: "bi-file-earmark-person" },
    { nombre: "Cursos", carpeta: "Cursos de Actualización", icono: "bi-award" },
    { nombre: "CV", carpeta: "Documentos Académicos", icono: "bi-file-earmark-richtext" },
    { nombre: "Títulos", carpeta: "Documentos Académicos", icono: "bi-mortarboard" },
    { nombre: "Cédulas profesionales", carpeta: "Documentos Académicos", icono: "bi-patch-check" },
    { nombre: "Recibo de luz", carpeta: "Documentos Familiares", icono: "bi-lightning-charge" },
    { nombre: "Recibo de teléfono", carpeta: "Documentos Familiares", icono: "bi-telephone" }
];

const TAMANO_MAXIMO = 10 * 1024 * 1024; // 10 MB
const TODAS = "Todos";

// ---------------------------------------------------------------------
// VARIABLES DE ESTADO
// ---------------------------------------------------------------------
let usuario = null;          // usuario con sesión iniciada
let documentos = [];         // documentos traídos de la base de datos
let carpetaActual = TODAS;   // carpeta seleccionada en la barra lateral
let modalDocumento = null;   // ventana para subir/editar
let modalVer = null;         // ventana para visualizar

// Elementos del HTML que usamos varias veces
const listaCarpetas = document.getElementById("lista-carpetas");
const listaRequeridos = document.getElementById("lista-requeridos");
const listaDocumentos = document.getElementById("lista-documentos");
const buscador = document.getElementById("buscador");
const formDocumento = document.getElementById("form-documento");
const campoId = document.getElementById("doc-id");
const campoTipo = document.getElementById("doc-tipo");
const campoCarpeta = document.getElementById("doc-carpeta");
const campoNombre = document.getElementById("doc-nombre");
const campoDescripcion = document.getElementById("doc-descripcion");
const campoArchivo = document.getElementById("doc-archivo");


// =====================================================================
//  MANEJO DE SESIONES
// =====================================================================

// PROTECCIÓN DE SESIÓN: si no hay sesión iniciada, regresa al login.
async function protegerPagina() {
    try {
        const { data, error } = await clienteSupabase.auth.getSession();
        if (error) throw error;

        if (!data.session) {
            window.location.replace("index.html");
            return null;
        }
        return data.session.user;
    } catch (error) {
        window.location.replace("index.html");
        return null;
    }
}

// CIERRE DE SESIÓN
async function cerrarSesion() {
    try {
        const { error } = await clienteSupabase.auth.signOut();
        if (error) throw error;
        window.location.replace("index.html");
    } catch (error) {
        mostrarMensaje("No se pudo cerrar la sesión: " + traducirError(error), "danger");
    }
}

// Si la sesión se cierra (por ejemplo, en otra pestaña), sale de la app
clienteSupabase.auth.onAuthStateChange((evento) => {
    if (evento === "SIGNED_OUT") {
        window.location.replace("index.html");
    }
});


// =====================================================================
//  PETICIONES A LA BASE DE DATOS (TABLA)
// =====================================================================

// READ: trae los documentos del usuario (las políticas RLS de Supabase
// solo regresan los documentos que le pertenecen)
async function cargarDocumentos() {
    try {
        const { data, error } = await clienteSupabase
            .from(TABLA)
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;

        documentos = data;
        pintarTodo();
    } catch (error) {
        mostrarMensaje("No se pudieron cargar los documentos: " + traducirError(error), "danger");
    }
}

// CREATE / UPDATE: guarda un documento nuevo o los cambios de uno existente
async function guardarDocumento(evento) {
    evento.preventDefault();

    const id = campoId.value;                // vacío = nuevo
    const archivo = campoArchivo.files[0];   // puede no haber archivo al editar
    const boton = document.getElementById("btn-guardar");

    // Validaciones antes de enviar
    if (!id && !archivo) {
        mostrarMensaje("Selecciona un archivo para subir.", "warning");
        return;
    }
    if (archivo && archivo.size > TAMANO_MAXIMO) {
        mostrarMensaje("El archivo es demasiado grande (máximo 10 MB).", "warning");
        return;
    }

    const datos = {
        nombre: campoNombre.value.trim(),
        tipo_documento: campoTipo.value,
        carpeta: campoCarpeta.value,
        descripcion: campoDescripcion.value.trim() || null
    };

    let rutaNueva = null;
    botonCargando(boton, true, "Guardando...");
    try {
        // 1) Si eligió un archivo, primero se sube a Storage
        if (archivo) {
            rutaNueva = await subirArchivo(archivo);
            datos.archivo_ruta = rutaNueva;
            datos.archivo_nombre = archivo.name;
            datos.archivo_tipo = archivo.type;
            datos.archivo_tamano = archivo.size;
        }

        // 2) Luego se guarda la información en la tabla
        if (id) {
            const anterior = documentos.find((doc) => doc.id === Number(id));
            datos.updated_at = new Date().toISOString();

            const { error } = await clienteSupabase.from(TABLA).update(datos).eq("id", id);
            if (error) throw error;

            // Si se reemplazó el archivo, se borra el anterior de Storage
            if (archivo && anterior) {
                await eliminarArchivo(anterior.archivo_ruta);
            }
            mostrarMensaje("Documento actualizado correctamente.", "success");
        } else {
            const { error } = await clienteSupabase.from(TABLA).insert(datos);
            if (error) throw error;
            mostrarMensaje("Documento guardado correctamente.", "success");
        }

        modalDocumento.hide();
        await cargarDocumentos();
    } catch (error) {
        // Si el archivo se subió pero la tabla falló, se borra para no dejar basura
        if (rutaNueva) {
            await eliminarArchivo(rutaNueva);
        }
        mostrarMensaje("No se pudo guardar: " + traducirError(error), "danger");
    } finally {
        botonCargando(boton, false);
    }
}

// DELETE: elimina el registro de la tabla y su archivo de Storage
async function eliminarDocumento(id) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;

    const confirmado = confirm(`¿Eliminar "${doc.nombre}"?\nEsta acción no se puede deshacer.`);
    if (!confirmado) return;

    try {
        const { error } = await clienteSupabase.from(TABLA).delete().eq("id", id);
        if (error) throw error;

        await eliminarArchivo(doc.archivo_ruta);
        mostrarMensaje("Documento eliminado.", "success");
        await cargarDocumentos();
    } catch (error) {
        mostrarMensaje("No se pudo eliminar: " + traducirError(error), "danger");
    }
}


// =====================================================================
//  PETICIONES DE ALMACENAMIENTO (STORAGE)
// =====================================================================

// Sube un archivo al bucket dentro de la carpeta del usuario.
// Ruta: <id-del-usuario>/<fecha>_<nombre-del-archivo>
async function subirArchivo(archivo) {
    const ruta = `${usuario.id}/${Date.now()}_${limpiarNombreArchivo(archivo.name)}`;

    const { error } = await clienteSupabase.storage
        .from(BUCKET)
        .upload(ruta, archivo, { contentType: archivo.type });
    if (error) throw error;

    return ruta;
}

// Borra un archivo del bucket (si falla solo se avisa en la consola)
async function eliminarArchivo(ruta) {
    const { error } = await clienteSupabase.storage.from(BUCKET).remove([ruta]);
    if (error) {
        console.error("No se pudo borrar el archivo de Storage:", error.message);
    }
}

// Pide un enlace temporal (10 minutos) para ver un archivo privado
async function verDocumento(id) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;

    try {
        const { data, error } = await clienteSupabase.storage
            .from(BUCKET)
            .createSignedUrl(doc.archivo_ruta, 60 * 10);
        if (error) throw error;

        const url = data.signedUrl;
        const contenido = document.getElementById("contenido-ver");
        document.getElementById("titulo-ver").textContent = doc.nombre;
        document.getElementById("btn-abrir").href = url;

        if (doc.archivo_tipo && doc.archivo_tipo.startsWith("image/")) {
            contenido.innerHTML = `<img src="${url}" alt="${escaparHTML(doc.nombre)}" class="img-fluid d-block mx-auto">`;
        } else if (doc.archivo_tipo === "application/pdf") {
            contenido.innerHTML = `<iframe src="${url}" title="${escaparHTML(doc.nombre)}"></iframe>`;
        } else {
            contenido.innerHTML = `<p class="p-4 mb-0">Este archivo no tiene vista previa. Usa "Abrir en otra pestaña".</p>`;
        }

        modalVer.show();
    } catch (error) {
        mostrarMensaje("No se pudo abrir el documento: " + traducirError(error), "danger");
    }
}


// =====================================================================
//  INTERFAZ: dibujar carpetas, requeridos y documentos
// =====================================================================

function pintarTodo() {
    pintarCarpetas();
    pintarRequeridos();
    pintarDocumentos();
}

// Barra lateral con las carpetas y cuántos documentos tiene cada una
function pintarCarpetas() {
    const opciones = [{ nombre: TODAS, icono: "bi-grid" }, ...CARPETAS];

    listaCarpetas.innerHTML = opciones.map((carpeta) => {
        const total = carpeta.nombre === TODAS
            ? documentos.length
            : documentos.filter((d) => d.carpeta === carpeta.nombre).length;
        const activa = carpeta.nombre === carpetaActual ? "active" : "";

        return `
            <button type="button" class="list-group-item list-group-item-action d-flex align-items-center ${activa}"
                    data-carpeta="${carpeta.nombre}">
                <i class="bi ${carpeta.icono} me-2"></i>
                <span class="me-auto">${carpeta.nombre}</span>
                <span class="badge rounded-pill contador">${total}</span>
            </button>`;
    }).join("");
}

// Tarjetitas de documentos requeridos: verde si ya se subió
function pintarRequeridos() {
    listaRequeridos.innerHTML = TIPOS.map((tipo) => {
        const subido = documentos.some((d) => d.tipo_documento === tipo.nombre);
        return `
            <button type="button" class="requerido ${subido ? "subido" : ""}" data-tipo="${tipo.nombre}"
                    title="${subido ? "Ya subido" : "Pendiente: clic para subir"}">
                <i class="bi ${tipo.icono}"></i>
                <span>${tipo.nombre}</span>
                <small>${subido ? '<i class="bi bi-check-circle-fill"></i> Subido' : "Pendiente"}</small>
            </button>`;
    }).join("");
}

// Lista de documentos filtrada por carpeta y por el BUSCADOR
function pintarDocumentos() {
    const texto = normalizar(buscador.value);

    const filtrados = documentos.filter((doc) => {
        const enCarpeta = carpetaActual === TODAS || doc.carpeta === carpetaActual;
        const coincide = normalizar(`${doc.nombre} ${doc.tipo_documento} ${doc.descripcion ?? ""} ${doc.archivo_nombre ?? ""}`)
            .includes(texto);
        return enCarpeta && coincide;
    });

    document.getElementById("titulo-carpeta").textContent =
        carpetaActual === TODAS ? "Todos los documentos" : carpetaActual;

    // Mensaje cuando no hay resultados
    const sinDocumentos = document.getElementById("sin-documentos");
    sinDocumentos.classList.toggle("d-none", filtrados.length > 0);
    document.getElementById("texto-sin-documentos").textContent = texto
        ? "No se encontraron archivos con esa búsqueda."
        : "No hay documentos en esta carpeta.";

    listaDocumentos.innerHTML = filtrados.map((doc) => {
        const tipo = TIPOS.find((t) => t.nombre === doc.tipo_documento);
        const esImagen = doc.archivo_tipo && doc.archivo_tipo.startsWith("image/");
        return `
            <div class="col">
                <article class="card h-100 tarjeta-documento">
                    <div class="card-body">
                        <div class="d-flex gap-3">
                            <div class="icono-documento"><i class="bi ${tipo ? tipo.icono : "bi-file-earmark"}"></i></div>
                            <div class="flex-grow-1 overflow-hidden">
                                <h3 class="h6 mb-1 text-truncate" title="${escaparHTML(doc.nombre)}">${escaparHTML(doc.nombre)}</h3>
                                <span class="badge etiqueta-tipo">${escaparHTML(doc.tipo_documento)}</span>
                                <p class="small text-body-secondary mb-0 mt-1">
                                    <i class="bi ${esImagen ? "bi-image" : "bi-file-earmark-pdf"}"></i>
                                    ${formatearTamano(doc.archivo_tamano)} · ${formatearFecha(doc.created_at)}
                                </p>
                            </div>
                        </div>
                        ${doc.descripcion ? `<p class="small mt-3 mb-0">${escaparHTML(doc.descripcion)}</p>` : ""}
                        <p class="small text-body-secondary mt-2 mb-0"><i class="bi bi-folder me-1"></i>${escaparHTML(doc.carpeta)}</p>
                    </div>
                    <div class="card-footer bg-transparent d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary flex-fill" data-accion="ver" data-id="${doc.id}">
                            <i class="bi bi-eye"></i> Ver</button>
                        <button class="btn btn-sm btn-outline-secondary flex-fill" data-accion="editar" data-id="${doc.id}">
                            <i class="bi bi-pencil"></i> Editar</button>
                        <button class="btn btn-sm btn-outline-danger flex-fill" data-accion="eliminar" data-id="${doc.id}">
                            <i class="bi bi-trash"></i> Eliminar</button>
                    </div>
                </article>
            </div>`;
    }).join("");
}


// =====================================================================
//  FORMULARIO (modal) PARA SUBIR / EDITAR
// =====================================================================

// Llena las listas desplegables de tipo y carpeta
function llenarSelects() {
    campoTipo.innerHTML = TIPOS.map((t) => `<option value="${t.nombre}">${t.nombre}</option>`).join("");
    campoCarpeta.innerHTML = CARPETAS.map((c) => `<option value="${c.nombre}">${c.nombre}</option>`).join("");
}

// Abre el formulario vacío para un documento nuevo
function abrirNuevo(tipoInicial = TIPOS[0].nombre) {
    formDocumento.reset();
    campoId.value = "";
    campoTipo.value = tipoInicial;
    campoCarpeta.value = TIPOS.find((t) => t.nombre === tipoInicial).carpeta;
    campoNombre.value = tipoInicial;
    campoArchivo.required = true;
    document.getElementById("titulo-modal").textContent = "Subir documento";
    document.getElementById("ayuda-archivo").textContent = "Formatos: PDF, JPG, PNG o WEBP.";
    modalDocumento.show();
}

// Abre el formulario con los datos de un documento para editarlo
function abrirEditar(id) {
    const doc = documentos.find((d) => d.id === id);
    if (!doc) return;

    formDocumento.reset();
    campoId.value = doc.id;
    campoTipo.value = doc.tipo_documento;
    campoCarpeta.value = doc.carpeta;
    campoNombre.value = doc.nombre;
    campoDescripcion.value = doc.descripcion ?? "";
    campoArchivo.required = false;
    document.getElementById("titulo-modal").textContent = "Editar documento";
    document.getElementById("ayuda-archivo").textContent =
        `Archivo actual: ${doc.archivo_nombre}. Elige otro solo si quieres reemplazarlo.`;
    modalDocumento.show();
}


// =====================================================================
//  FUNCIONES PEQUEÑAS DE APOYO
// =====================================================================

// Quita acentos y caracteres raros del nombre del archivo
function limpiarNombreArchivo(nombre) {
    return nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
}

// Para que el buscador ignore mayúsculas y acentos
function normalizar(texto) {
    return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function formatearTamano(bytes) {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatearFecha(fecha) {
    return new Date(fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function cerrarBarraLateralEnCelular() {
    const panel = bootstrap.Offcanvas.getInstance(document.getElementById("barra-lateral"));
    if (panel) panel.hide();
}


// =====================================================================
//  EVENTOS
// =====================================================================
function conectarEventos() {
    document.getElementById("btn-cerrar-sesion").addEventListener("click", cerrarSesion);
    document.getElementById("btn-nuevo").addEventListener("click", () => abrirNuevo());
    formDocumento.addEventListener("submit", guardarDocumento);
    buscador.addEventListener("input", pintarDocumentos);

    // Menú principal
    document.getElementById("menu-subir").addEventListener("click", (e) => {
        e.preventDefault();
        abrirNuevo();
    });
    const irAInicio = (e) => {
        e.preventDefault();
        carpetaActual = TODAS;
        buscador.value = "";
        pintarTodo();
        window.scrollTo({ top: 0, behavior: "smooth" });
    };
    document.getElementById("menu-inicio").addEventListener("click", irAInicio);
    document.getElementById("menu-logo").addEventListener("click", irAInicio);

    // Al cambiar el tipo de un documento nuevo, se sugiere su carpeta
    campoTipo.addEventListener("change", () => {
        if (!campoId.value) {
            campoCarpeta.value = TIPOS.find((t) => t.nombre === campoTipo.value).carpeta;
            campoNombre.value = campoTipo.value;
        }
    });

    // Clic en una carpeta de la barra lateral
    listaCarpetas.addEventListener("click", (e) => {
        const boton = e.target.closest("[data-carpeta]");
        if (!boton) return;
        carpetaActual = boton.dataset.carpeta;
        pintarCarpetas();
        pintarDocumentos();
        cerrarBarraLateralEnCelular();
    });

    // Clic en un documento requerido: abre el formulario con ese tipo
    listaRequeridos.addEventListener("click", (e) => {
        const boton = e.target.closest("[data-tipo]");
        if (boton) abrirNuevo(boton.dataset.tipo);
    });

    // Botones Ver / Editar / Eliminar de cada tarjeta
    listaDocumentos.addEventListener("click", (e) => {
        const boton = e.target.closest("[data-accion]");
        if (!boton) return;
        const id = Number(boton.dataset.id);

        if (boton.dataset.accion === "ver") verDocumento(id);
        if (boton.dataset.accion === "editar") abrirEditar(id);
        if (boton.dataset.accion === "eliminar") eliminarDocumento(id);
    });

    // Al cerrar la vista previa se quita el archivo para liberar memoria
    document.getElementById("modal-ver").addEventListener("hidden.bs.modal", () => {
        document.getElementById("contenido-ver").innerHTML = "";
    });
}


// =====================================================================
//  INICIO DE LA APLICACIÓN
// =====================================================================
async function iniciar() {
    usuario = await protegerPagina();
    if (!usuario) return; // sin sesión: ya se mandó al login

    document.body.classList.remove("oculto");
    document.getElementById("correo-usuario").textContent = usuario.email;

    modalDocumento = new bootstrap.Modal(document.getElementById("modal-documento"));
    modalVer = new bootstrap.Modal(document.getElementById("modal-ver"));

    llenarSelects();
    conectarEventos();
    await cargarDocumentos();
}

iniciar();
