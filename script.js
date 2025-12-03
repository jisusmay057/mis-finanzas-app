const API_URL = "https://sheetdb.io/api/v1/1o3za5hmysvh8";

// CONFIGURACIÓN DE TUS TARJETAS
const MIS_TARJETAS = {
    "BBVA": { cierre: 10, pago: 5, limite: 1000, meta: 1.0, inicio: 561.35 }, 
    "Falabella": { cierre: 20, pago: 15, limite: 1900, meta: 0.40, inicio: 1834.87 } 
};

// VARIABLES DE APP
let misGastos = [];
let sueldoQuincenal = parseFloat(localStorage.getItem('miSueldoQuincenal')) || 0;
let chartCategorias, chartMensual, chartBBVA, chartFalabella;

// DOM
const inputDesc = document.getElementById('descripcion');
const inputMonto = document.getElementById('monto');
const inputMetodo = document.getElementById('metodo');
const inputCat = document.getElementById('categoria');
const inputNotas = document.getElementById('notas');
const btnAgregar = document.getElementById('btn-agregar');
const listaGastos = document.getElementById('lista-gastos');

init();

async function init() { await cargarDatos(); }

// --- NAVEGACIÓN ---
window.cambiarPestana = function(pestana) {
    ['registro', 'credito', 'dashboard'].forEach(p => {
        document.getElementById(`vista-${p}`).classList.add('oculto');
        document.getElementById(`tab-${p}`).classList.remove('activo');
    });
    document.getElementById(`vista-${pestana}`).classList.remove('oculto');
    document.getElementById(`tab-${pestana}`).classList.add('activo');

    if (pestana === 'credito') calcularModuloCredito();
    if (pestana === 'dashboard') {
        calcularPresupuestoQuincenal();
        actualizarGraficosDashboard();
    }
}

window.cambiarColorForm = function(tipo) {
    const btn = document.getElementById('btn-agregar');
    const cat = document.getElementById('grupo-categoria');
    if(tipo === 'gasto') {
        btn.style.backgroundColor = '#ff1744'; btn.innerText = 'REGISTRAR GASTO'; cat.style.opacity = '1';
    } else {
        btn.style.backgroundColor = '#00e676'; btn.innerText = 'REGISTRAR INGRESO / PAGO'; cat.style.opacity = '0.3';
    }
}

// --- LÓGICA DE DATOS ---
async function cargarDatos() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        misGastos = data.map(g => ({...g, monto: parseFloat(g.monto)})).sort((a,b) => b.id - a.id);
        renderizarLista();
    } catch (e) { console.error(e); }
}

async function guardarGasto() {
    const desc = inputDesc.value;
    const monto = parseFloat(inputMonto.value);
    const tipo = document.querySelector('input[name="tipo"]:checked').value;

    if (!desc || isNaN(monto) || monto <= 0) return;

    btnAgregar.innerText = "PROCESANDO..."; btnAgregar.disabled = true;

    const nuevo = {
        id: Date.now(), fecha: new Date().toISOString(), desc: desc,
        categoria: inputCat.value, metodo: inputMetodo.value, tipo: tipo,
        notas: inputNotas.value || '', monto: monto
    };

    try {
        await fetch(API_URL, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(nuevo) });
        misGastos.unshift(nuevo);
        renderizarLista();
        inputDesc.value = ''; inputMonto.value = '';
        mostrarNotificacion(tipo === 'gasto' ? "GASTO REGISTRADO" : "OPERACIÓN EXITOSA");
    } catch (e) { alert("Error al guardar"); }
    btnAgregar.innerText = tipo === 'gasto' ? "REGISTRAR GASTO" : "REGISTRAR PAGO"; btnAgregar.disabled = false;
}

window.eliminar = async function(id) {
    if(!confirm("¿Eliminar registro?")) return;
    try {
        await fetch(`${API_URL}/id/${id}`, { method: 'DELETE' });
        misGastos = misGastos.filter(g => g.id != id);
        renderizarLista();
    } catch(e) {}
}

function renderizarLista() {
    listaGastos.innerHTML = '';
    misGastos.forEach(g => {
        let f = new Date(g.fecha);
        let fecha = !isNaN(f) ? `${f.getDate()}/${f.getMonth()+1}` : '--/--';
        let esPago = g.tipo === 'pago';
        let claseColor = esPago ? 'monto-pago' : 'monto-gasto';
        let signo = esPago ? '+' : '-';
        let icono = g.metodo === 'BBVA' ? '🔵' : (g.metodo === 'Falabella' ? '🟢' : '💵');
        listaGastos.innerHTML += `
            <li id="item-${g.id}">
                <div style="display:flex; align-items:center;">
                    <span style="font-size:1.2em; margin-right:10px;">${icono}</span>
                    <div><div class="desc">${g.desc}</div><div class="subtext">${fecha} • ${g.metodo}</div></div>
                </div>
                <div style="text-align:right;"><div class="${claseColor}">${signo} S/ ${g.monto.toFixed(2)}</div>
                <small onclick="eliminar(${g.id})" style="color:#586577; font-size:0.6em; cursor:pointer;">BORRAR</small></div>
            </li>`;
    });
}

// --- MÓDULO 1: CRÉDITO ---
function calcularModuloCredito() {
    const contenedor = document.getElementById('contenedor-tarjetas');
    const totalGlobal = document.getElementById('deuda-total-global');
    contenedor.innerHTML = '';
    
    let deudaTotalSum = 0;

    Object.keys(MIS_TARJETAS).forEach(nombreCard => {
        const config = MIS_TARJETAS[nombreCard];
        const movs = misGastos.filter(g => g.metodo === nombreCard);
        
        let gastado = 0; let pagado = 0;
        movs.forEach(g => { if (g.tipo === 'pago') pagado += g.monto; else gastado += g.monto; });

        let deudaActual = (config.inicio + gastado) - pagado;
        if (deudaActual < 0) deudaActual = 0;
        deudaTotalSum += deudaActual;

        let disponible = config.limite - deudaActual;
        let porcentaje = (deudaActual / config.limite) * 100;
        let color = '#00e5ff'; 
        if (config.meta < 1.0 && deudaActual > (config.limite * config.meta)) color = '#ff1744';

        contenedor.innerHTML += `
            <div class="card-tarjeta">
                <h4>${nombreCard} <span>💳</span></h4>
                <div class="fechas-pago">Cierre: ${config.cierre} | Pagar: ${config.pago}</div>
                <div class="info-saldos"><span style="color:#ff1744">Deuda: S/ ${deudaActual.toFixed(2)}</span><span style="color:#00e5ff">Libre: S/ ${disponible.toFixed(2)}</span></div>
                <div class="barra-fondo"><div class="barra-progreso" style="width: ${porcentaje}%; background: ${color}; box-shadow: 0 0 8px ${color};"></div></div>
            </div>`;
    });
    totalGlobal.innerText = `S/ ${deudaTotalSum.toFixed(2)}`;

    generarGraficoTarjeta('BBVA', 'graficoBBVA', ['#2979ff', '#1565c0', '#64b5f6']);
    generarGraficoTarjeta('Falabella', 'graficoFalabella', ['#00e676', '#00c853', '#69f0ae']);
}

function generarGraficoTarjeta(nombreCard, canvasId, paleta) {
    const ctx = document.getElementById(canvasId);
    let dataCat = {};
    misGastos.filter(g => g.metodo === nombreCard && g.tipo === 'gasto').forEach(g => {
        dataCat[g.categoria] = (dataCat[g.categoria] || 0) + g.monto;
    });

    if(nombreCard === 'BBVA') { if(chartBBVA) chartBBVA.destroy(); }
    else { if(chartFalabella) chartFalabella.destroy(); }

    const config = {
        type: 'doughnut',
        data: { labels: Object.keys(dataCat), datasets: [{ data: Object.values(dataCat), backgroundColor: paleta, borderWidth: 0 }] },
        options: { cutout: '65%', plugins: { legend: { display: false } } }
    };

    if(nombreCard === 'BBVA') chartBBVA = new Chart(ctx, config);
    else chartFalabella = new Chart(ctx, config);
}

// --- MÓDULO 2: CALCULADORA ---
window.configurarSueldo = function() {
    let nuevo = prompt("Ingresa tu sueldo líquido quincenal (S/):", sueldoQuincenal);
    if(nuevo) {
        sueldoQuincenal = parseFloat(nuevo);
        localStorage.setItem('miSueldoQuincenal', sueldoQuincenal);
        calcularPresupuestoQuincenal();
    }
}

function calcularPresupuestoQuincenal() {
    const hoy = new Date();
    const dia = hoy.getDate();
    let inicioRango, finRango;

    if (dia <= 15) { inicioRango = 1; finRango = 15; }
    else { inicioRango = 16; finRango = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate(); }

    let gastadoQuincena = 0;
    misGastos.filter(g => g.tipo === 'gasto').forEach(g => {
        let d = new Date(g.fecha);
        if(d.getMonth() === hoy.getMonth() && d.getDate() >= inicioRango && d.getDate() <= finRango) {
            gastadoQuincena += g.monto;
        }
    });

    let restante = sueldoQuincenal - gastadoQuincena;
    let diasFaltantes = finRango - dia + 1;
    let diario = diasFaltantes > 0 ? (restante / diasFaltantes) : 0;

    document.getElementById('calc-ingreso').innerText = `S/ ${sueldoQuincenal.toFixed(2)}`;
    document.getElementById('calc-gastado').innerText = `S/ ${gastadoQuincena.toFixed(2)}`;
    const elRestante = document.getElementById('calc-restante');
    elRestante.innerText = `S/ ${restante.toFixed(2)}`;
    elRestante.style.color = restante > 0 ? '#00e676' : '#ff1744';
    document.getElementById('calc-diario').innerText = `(S/ ${diario.toFixed(2)} por día restante)`;
}

// --- MÓDULO 3: GRÁFICO HISTÓRICO DESLIZABLE CON ALERTAS ---
function actualizarGraficosDashboard() {
    let dataCat = {};
    let dataDiaria = {};

    const soloGastos = misGastos.filter(g => g.tipo !== 'pago');
    // Ordenamos cronológicamente (antiguo a nuevo) para la línea de tiempo
    const ordenados = [...soloGastos].sort((a,b) => new Date(a.fecha) - new Date(b.fecha));

    // 1. Agrupar Datos
    ordenados.forEach(g => {
        dataCat[g.categoria] = (dataCat[g.categoria] || 0) + g.monto;
        let d = new Date(g.fecha);
        let diaKey = `${d.getDate()}/${d.getMonth()+1}`; // Formato Día/Mes
        dataDiaria[diaKey] = (dataDiaria[diaKey] || 0) + g.monto;
    });

    // 2. Calcular Promedio para Alertas
    const valoresDiarios = Object.values(dataDiaria);
    const sumaTotal = valoresDiarios.reduce((a, b) => a + b, 0);
    const promedio = sumaTotal / (valoresDiarios.length || 1);
    const umbralAlerta = promedio * 1.5; // Si superas el 150% del promedio, es Alerta

    // 3. Generar Colores Dinámicos
    const coloresBarras = valoresDiarios.map(valor => {
        return valor > umbralAlerta ? '#ff1744' : '#2d3748'; // Rojo si es pico, Gris si es normal
    });

    // 4. Configurar Ancho del Contenedor (Scroll Infinito)
    const container = document.querySelector('.chart-long-container');
    const minWidth = Math.max(800, Object.keys(dataDiaria).length * 50); // Mínimo 800px o 50px por barra
    container.style.minWidth = `${minWidth}px`;

    // 5. Renderizar Gráficos
    if (chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(document.getElementById('graficoCategorias'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(dataCat),
            datasets: [{ data: Object.values(dataCat), backgroundColor: ['#ff1744', '#00e5ff', '#ff9100', '#d500f9', '#00e676'], borderWidth: 0 }]
        }, options: { cutout: '70%', plugins: { legend: { display: false } } }
    });

    if (chartMensual) chartMensual.destroy();
    chartMensual = new Chart(document.getElementById('graficoMensual'), {
        type: 'bar',
        data: { 
            labels: Object.keys(dataDiaria), 
            datasets: [{ 
                data: valoresDiarios, 
                backgroundColor: coloresBarras, // Colores dinámicos (Alerta Roja)
                borderRadius: 4,
                barPercentage: 0.8
            }] 
        },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false }, ticks: { color: '#586577' } }, y: { display: false } }
        }
    });
}

function mostrarNotificacion(msj) { 
    const t = document.getElementById('toast'); 
    t.innerText = msj; t.classList.add('visible'); 
    setTimeout(() => t.classList.remove('visible'), 2000); 
}

window.verificarTarjeta = function() {}; // Placeholder simple