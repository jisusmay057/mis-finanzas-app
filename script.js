// ==========================================
const API_URL = "https://sheetdb.io/api/v1/1o3za5hmysvh8";
// ==========================================

const inputDesc = document.getElementById('descripcion');
const inputCat = document.getElementById('categoria');
const inputNotas = document.getElementById('notas');
const inputMonto = document.getElementById('monto');
const btnAgregar = document.getElementById('btn-agregar');
const toast = document.getElementById('toast');
const listaGastos = document.getElementById('lista-gastos');
const totalSpan = document.getElementById('total-monto');

let misGastos = [];
let chartCategorias, chartMensual, chartTrimestral;

// INICIO
init();

async function init() {
    // Ya no necesitamos verificarEnter() porque usamos <form>
    await cargarDatos();
}

// PESTAÑAS
window.cambiarPestana = function(pestana) {
    document.getElementById('vista-registro').classList.toggle('oculto', pestana !== 'registro');
    document.getElementById('vista-dashboard').classList.toggle('oculto', pestana !== 'dashboard');
    document.getElementById('tab-registro').classList.toggle('activo', pestana === 'registro');
    document.getElementById('tab-dashboard').classList.toggle('activo', pestana === 'dashboard');
    if (pestana === 'dashboard') actualizarGraficos();
}

// 1. CARGAR DATOS
async function cargarDatos() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        misGastos = data.map(g => ({...g, monto: parseFloat(g.monto)})).sort((a,b) => b.id - a.id);
        renderizarLista();
        mostrarNotificacion("☁️ Datos actualizados");
    } catch (error) {
        listaGastos.innerHTML = '<li style="justify-content:center; text-align:center; color:#f87171;">Error de conexión.<br>Verifica tu internet.</li>';
    }
}

// 2. GUARDAR DATOS (Llamado desde el formulario)
async function guardarGasto() {
    // No necesitamos validar teclas, el form lo hace por nosotros
    const desc = inputDesc.value;
    const monto = parseFloat(inputMonto.value);

    // Validación extra
    if (!desc || isNaN(monto) || monto <= 0) return;

    btnAgregar.innerText = "Enviando...";
    btnAgregar.disabled = true;
    btnAgregar.style.opacity = "0.7";

    const nuevo = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        desc: desc,
        categoria: inputCat.value,
        notas: inputNotas.value || '',
        monto: monto
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(nuevo)
        });

        misGastos.unshift(nuevo);
        renderizarLista();
        limpiarFormulario();
        mostrarNotificacion("✅ Guardado en Drive");
    } catch (e) {
        alert("Error al guardar: " + e.message);
    }

    btnAgregar.innerText = "Guardar en Drive";
    btnAgregar.disabled = false;
    btnAgregar.style.opacity = "1";
}

// 3. ELIMINAR
window.eliminar = async function(id) {
    if(!confirm("¿Eliminar de la nube?")) return;
    const item = document.getElementById(`item-${id}`);
    if(item) item.style.opacity = '0.3';

    try {
        await fetch(`${API_URL}/id/${id}`, { method: 'DELETE' });
        misGastos = misGastos.filter(g => g.id != id);
        renderizarLista();
        mostrarNotificacion("🗑️ Eliminado");
    } catch (e) {
        alert("Error al eliminar");
        if(item) item.style.opacity = '1';
    }
}

// VISUALIZACIÓN
function renderizarLista() {
    listaGastos.innerHTML = '';
    let total = 0;
    const colores = { 'Alimentación': '#F472B6', 'Transporte': '#60A5FA', 'Servicios': '#FBBF24', 'Entretenimiento': '#34D399', 'Salud': '#A78BFA', 'Otros': '#9CA3AF' };

    misGastos.forEach(g => {
        total += g.monto;
        let f = new Date(g.fecha);
        let fechaStr = !isNaN(f) ? `${f.getDate()}/${f.getMonth()+1}` : 'Hoy';

        listaGastos.innerHTML += `
            <li id="item-${g.id}">
                <div style="display:flex; align-items:center;">
                    <span class="cat-dot" style="background:${colores[g.categoria] || '#999'}"></span>
                    <div>
                        <div class="desc">${g.desc}</div>
                        <div class="subtext">${fechaStr} • ${g.categoria}</div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:bold;">S/ ${g.monto.toFixed(2)}</div>
                    <small style="color:#f87171; padding:5px; cursor:pointer;" onclick="eliminar(${g.id})">Eliminar</small>
                </div>
            </li>`;
    });
    totalSpan.innerText = `S/ ${total.toFixed(2)}`;
}

// GRÁFICOS
function actualizarGraficos() {
    let dataCat = {}, dataDiaria = {}, dataTri = {};
    let ordenados = [...misGastos].sort((a,b) => new Date(a.fecha) - new Date(b.fecha));

    ordenados.forEach(g => {
        dataCat[g.categoria] = (dataCat[g.categoria] || 0) + g.monto;
        let d = new Date(g.fecha); if(isNaN(d)) d = new Date();
        let diaKey = `${d.getDate()}/${d.getMonth()+1}`;
        dataDiaria[diaKey] = (dataDiaria[diaKey] || 0) + g.monto;
        let triKey = `T${Math.ceil((d.getMonth()+1)/3)}`;
        dataTri[triKey] = (dataTri[triKey] || 0) + g.monto;
    });

    const opts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: '#94a3b8' } }, y: { display: false } } };

    if (chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(document.getElementById('graficoCategorias'), {
        type: 'doughnut', data: { labels: Object.keys(dataCat), datasets: [{ data: Object.values(dataCat), backgroundColor: ['#F472B6', '#60A5FA', '#FBBF24', '#34D399', '#A78BFA', '#9CA3AF'], borderColor: '#1e293b', borderWidth: 2 }] }, options: { cutout: '70%', plugins: { legend: { display: false } } }
    });

    if (chartMensual) chartMensual.destroy();
    chartMensual = new Chart(document.getElementById('graficoMensual'), {
        type: 'bar', data: { labels: Object.keys(dataDiaria), datasets: [{ data: Object.values(dataDiaria), backgroundColor: '#cbd5e1', borderRadius: 4, barPercentage: 0.5, maxBarThickness: 30 }] }, options: opts
    });

    if (chartTrimestral) chartTrimestral.destroy();
    chartTrimestral = new Chart(document.getElementById('graficoTrimestral'), {
        type: 'line', data: { labels: Object.keys(dataTri), datasets: [{ data: Object.values(dataTri), borderColor: '#2dd4bf', backgroundColor: 'rgba(45, 212, 191, 0.1)', fill: true, tension: 0.4, pointBorderColor: '#2dd4bf' }] }, options: opts
    });
}

function limpiarFormulario() { inputDesc.value = ''; inputNotas.value = ''; inputMonto.value = ''; inputDesc.focus(); }
function mostrarNotificacion(msj) { toast.innerText = msj; toast.classList.add('visible'); setTimeout(() => toast.classList.remove('visible'), 2000); }