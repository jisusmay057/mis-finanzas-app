// ==========================================
// 1. TU API
const API_URL = "https://sheetdb.io/api/v1/1o3za5hmysvh8";

// 2. CONFIGURACIÓN DE TUS TARJETAS (AQUÍ ESTÁ TU LÓGICA)
const MIS_TARJETAS = {
    "BBVA": {
        cierre: 10,   // Cierra el 10
        pago: 5,      // Paga el 5
        limite: 0,    // No especificaste límite, lo dejaremos infinito
        meta: 0       // Sin meta específica
    },
    "Falabella": {
        cierre: 20,   // Cierra el 20
        pago: 15,     // Paga el 15
        limite: 1900, // Saldo total
        meta: 0.40    // 40% (Quieres usar max 760)
    }
};
// ==========================================

const inputDesc = document.getElementById('descripcion');
const inputMetodo = document.getElementById('metodo'); // Nuevo
const inputCat = document.getElementById('categoria');
const inputNotas = document.getElementById('notas');
const inputMonto = document.getElementById('monto');
const btnAgregar = document.getElementById('btn-agregar');
const toast = document.getElementById('toast');
const listaGastos = document.getElementById('lista-gastos');

let misGastos = [];
let chartCategorias;

init();

async function init() {
    await cargarDatos();
}

window.cambiarPestana = function(pestana) {
    document.getElementById('vista-registro').classList.toggle('oculto', pestana !== 'registro');
    document.getElementById('vista-dashboard').classList.toggle('oculto', pestana !== 'dashboard');
    document.getElementById('tab-registro').classList.toggle('activo', pestana === 'registro');
    document.getElementById('tab-dashboard').classList.toggle('activo', pestana === 'dashboard');
    if (pestana === 'dashboard') analizarTarjetas();
}

// LÓGICA DE CICLO DE FACTURACIÓN
window.verificarTarjeta = function() {
    const tarjeta = MIS_TARJETAS[inputMetodo.value];
    const aviso = document.getElementById('aviso-ciclo');
    
    if (tarjeta) {
        const hoy = new Date().getDate();
        // Si hoy es mayor al día de cierre (Ej: Hoy 12, cierra 10)
        if (hoy > tarjeta.cierre) {
            aviso.innerText = `ℹ️ El corte fue el ${tarjeta.cierre}. Esto se paga el próximo mes.`;
            aviso.style.display = 'block';
        } else {
            aviso.style.display = 'none';
        }
    } else {
        aviso.style.display = 'none';
    }
}

async function cargarDatos() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        misGastos = data.map(g => ({...g, monto: parseFloat(g.monto)})).sort((a,b) => b.id - a.id);
        renderizarLista();
        mostrarNotificacion("☁️ Sincronizado");
    } catch (error) {
        listaGastos.innerHTML = '<li style="justify-content:center; color:#f87171;">Error de red</li>';
    }
}

async function guardarGasto() {
    const desc = inputDesc.value;
    const monto = parseFloat(inputMonto.value);

    if (!desc || isNaN(monto) || monto <= 0) return;

    btnAgregar.innerText = "Procesando...";
    btnAgregar.disabled = true;

    const nuevo = {
        id: Date.now(),
        fecha: new Date().toISOString(),
        desc: desc,
        categoria: inputCat.value,
        metodo: inputMetodo.value, // GUARDAMOS EL MÉTODO
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
        
        // Limpieza
        inputDesc.value = ''; inputNotas.value = ''; inputMonto.value = ''; inputDesc.focus();
        mostrarNotificacion("✅ Guardado");
    } catch (e) {
        alert("Error al guardar");
    }
    btnAgregar.innerText = "Guardar en Drive";
    btnAgregar.disabled = false;
}

window.eliminar = async function(id) {
    if(!confirm("¿Borrar?")) return;
    try {
        await fetch(`${API_URL}/id/${id}`, { method: 'DELETE' });
        misGastos = misGastos.filter(g => g.id != id);
        renderizarLista();
        mostrarNotificacion("🗑️ Eliminado");
    } catch (e) { alert("Error"); }
}

function renderizarLista() {
    listaGastos.innerHTML = '';
    
    misGastos.forEach(g => {
        let f = new Date(g.fecha);
        let fechaStr = !isNaN(f) ? `${f.getDate()}/${f.getMonth()+1}` : 'Hoy';
        
        // Icono según método
        let icono = '💵';
        if (g.metodo === 'BBVA') icono = '🔵'; 
        if (g.metodo === 'Falabella') icono = '🟢';

        listaGastos.innerHTML += `
            <li id="item-${g.id}">
                <div style="display:flex; align-items:center;">
                    <span class="icon-pay">${icono}</span>
                    <div>
                        <div class="desc">${g.desc}</div>
                        <div class="subtext">${fechaStr} • ${g.categoria}</div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:bold;">S/ ${g.monto.toFixed(2)}</div>
                    <small style="color:#f87171; cursor:pointer;" onclick="eliminar(${g.id})">✕</small>
                </div>
            </li>`;
    });
}

// --- CEREBRO DE TARJETAS ---
function analizarTarjetas() {
    const contenedor = document.getElementById('contenedor-tarjetas');
    const totalDeudaElem = document.getElementById('total-deuda');
    contenedor.innerHTML = '';
    
    let deudaTotal = 0;
    const hoy = new Date();
    const mesActual = hoy.getMonth(); 

    // 1. Filtrar gastos de este mes (Ciclo activo)
    // Nota: Esto es un cálculo simplificado basado en el mes calendario para la visualización rápida
    const gastosDelMes = misGastos.filter(g => {
        const f = new Date(g.fecha);
        return f.getMonth() === mesActual;
    });

    // 2. Calcular por tarjeta
    const tarjetas = ['BBVA', 'Falabella'];
    
    tarjetas.forEach(nombreCard => {
        // Sumar gastos de esta tarjeta
        const totalCard = gastosDelMes
            .filter(g => g.metodo === nombreCard)
            .reduce((sum, g) => sum + g.monto, 0);

        deudaTotal += totalCard;

        // Configuración de la tarjeta
        const config = MIS_TARJETAS[nombreCard];
        let barraHTML = '';

        if (config.limite > 0) {
            // Lógica para Falabella (Límite y Meta)
            const metaDinero = config.limite * config.meta; // 1900 * 0.40 = 760
            const porcentajeUso = (totalCard / config.limite) * 100;
            
            // Color de la barra
            let colorBarra = '#10b981'; // Verde (Bien)
            if (totalCard > metaDinero) colorBarra = '#ef4444'; // Rojo (Te pasaste del 40%)
            else if (totalCard > (metaDinero * 0.8)) colorBarra = '#f59e0b'; // Naranja (Cerca)

            barraHTML = `
                <div class="info-limite">
                    <span>Usado: S/ ${totalCard.toFixed(2)}</span>
                    <span>Meta (40%): S/ ${metaDinero.toFixed(0)}</span>
                </div>
                <div class="barra-fondo">
                    <div class="barra-progreso" style="width: ${porcentajeUso}%; background: ${colorBarra};"></div>
                </div>
                <div style="text-align:right; font-size:0.7rem; color:#64748b; margin-top:2px;">
                    Límite total: S/ ${config.limite}
                </div>
            `;
        } else {
            // Lógica para BBVA (Sin límite definido)
            barraHTML = `
                <div class="info-limite">
                    <span>Gasto Mes: S/ ${totalCard.toFixed(2)}</span>
                </div>
                <div class="barra-fondo">
                    <div class="barra-progreso" style="width: 100%; background: #3b82f6;"></div>
                </div>
            `;
        }

        contenedor.innerHTML += `
            <div class="card-tarjeta">
                <div style="display:flex; justify-content:space-between;">
                    <h4>${nombreCard}</h4>
                    <span style="font-size:0.8rem; color:#94a3b8;">Cierra: día ${config.cierre}</span>
                </div>
                <div class="fechas-pago">Pagar antes del: día ${config.pago}</div>
                ${barraHTML}
            </div>
        `;
    });

    totalDeudaElem.innerText = `S/ ${deudaTotal.toFixed(2)}`;
    
    // Gráfico Categorías
    actualizarGraficoPastel();
}

function actualizarGraficoPastel() {
    // Reutilizamos lógica simple para el pastel
    let dataCat = {};
    misGastos.forEach(g => dataCat[g.categoria] = (dataCat[g.categoria] || 0) + g.monto);
    
    if (chartCategorias) chartCategorias.destroy();
    chartCategorias = new Chart(document.getElementById('graficoCategorias'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(dataCat),
            datasets: [{ data: Object.values(dataCat), backgroundColor: ['#F472B6', '#60A5FA', '#FBBF24', '#34D399', '#A78BFA', '#9CA3AF'], borderWidth: 0 }]
        }, options: { plugins: { legend: { display: false } } }
    });
}

function mostrarNotificacion(msj) { toast.innerText = msj; toast.classList.add('visible'); setTimeout(() => toast.classList.remove('visible'), 2000); }