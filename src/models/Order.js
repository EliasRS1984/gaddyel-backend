import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    // Número de orden único e incremental (formato: #000001)
    orderNumber: {
        type: String,
        unique: true,
        sparse: true
    },
    
    // Referencias
    clienteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Client',
        required: true
    },
    
    // Items del carrito
    items: [
        {
            productoId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Producto',
                required: true
            },
            nombre: {
                type: String,
                required: true
            },
            cantidad: {
                type: Number,
                required: true,
                min: 1
            },
            cantidadUnidades: {
                type: Number,
                default: 1,
                min: 1
            },
            precioUnitario: {
                type: Number,
                required: true,
                min: 0
            },
            subtotal: {
                type: Number,
                required: true,
                min: 0
            }
        }
    ],
    
    // Totales (en centavos para evitar problemas de decimales)
    total: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Desglose de costos
    subtotal: {
        type: Number,
        default: 0,
        min: 0
    },
    costoEnvio: {
        type: Number,
        default: 0,
        min: 0
    },
    impuestos: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Cantidad total de productos (para cálculo de envío)
    cantidadProductos: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // ═══════════════════════════════════════════════════════════════
    // ESTADOS: SEPARACIÓN ENTRE PAGO Y PRODUCCIÓN
    // ═══════════════════════════════════════════════════════════════
    
    // 💳 ESTADO DE PAGO (Mercado Pago)
    // Controla: ¿El cliente pagó correctamente?
    // Valores: pending, approved, rejected, cancelled, expired, refunded
    // Responsable: Webhook de Mercado Pago actualiza este campo
    // Uso: Determina si la orden es válida para producción
    estadoPago: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired', 'refunded'],
        default: 'pending'
    },
    
    // 🏭 ESTADO DE PRODUCCIÓN (Interno)
    // Controla: ¿En qué fase está la producción del pedido?
    // Valores: en_produccion, enviado, entregado
    // Responsable: Admin actualiza manualmente según avance
    // Uso: Seguimiento de fabricación y envío de productos
    // FLUJO:
    //   1. en_produccion: Pago aprobado, iniciar fabricación (automático)
    //   2. enviado: Admin marca cuando despacha el pedido (manual)
    //   3. entregado: Admin marca cuando cliente confirma recepción (manual - cierra pedido)
    estadoPedido: {
        type: String,
        enum: ['en_produccion', 'enviado', 'entregado'],
        default: 'en_produccion' // Default para compatibilidad con código existente
    },
    
    // ═══════════════════════════════════════════════════════════════
    // CAMPOS LEGACY (DEPRECATED - Mantener solo por compatibilidad)
    // ═══════════════════════════════════════════════════════════════
    // ⚠️ NO USAR EN CÓDIGO NUEVO - Migrar a payment.mercadoPago.*
    
    // @deprecated Usar payment.mercadoPago.preferenceId
    mercadoPagoId: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
        select: false // No incluir en queries por defecto
    },
    
    // @deprecated Usar payment.mercadoPago.paymentId
    mercadoPagoPaymentId: {
        type: String,
        sparse: true,
        index: true,
        select: false
    },
    
    // @deprecated Usar payment.mercadoPago.initPoint
    mercadoPagoCheckoutUrl: {
        type: String,
        select: false
    },
    
    // ===== PAYMENT (NUEVO - Sistema 2025) =====
    payment: {
        // Información de Mercado Pago
        mercadoPago: {
            // Preferencia de pago
            preferenceId: {
                type: String,
                sparse: true,
                index: true
            },
            initPoint: String,
            sandboxInitPoint: String,
            
            // Información del pago
            paymentId: {
                type: String,
                sparse: true,
                index: true
            },
            status: {
                type: String,
                enum: ['pending', 'approved', 'authorized', 'in_process', 'in_mediation', 
                       'rejected', 'cancelled', 'refunded', 'charged_back'],
                default: 'pending'
            },
            statusDetail: String,
            
            // Método de pago
            paymentType: String, // 'account_money', 'credit_card', 'debit_card', etc.
            paymentMethod: String, // 'visa', 'master', 'mercadopago', etc.
            
            // Montos
            transactionAmount: Number,
            netAmount: Number,
            
            // Cuotas
            installments: Number,
            
            // Fechas
            createdAt: Date,
            lastUpdate: Date,
            approvedAt: Date,
            
            // Comprador en MP
            payerEmail: String,
            payerId: String,
            
            // Información adicional
            authorizationCode: String,
            merchantAccountId: String
            ,
            // Desglose de comisiones del procesador (calculado desde webhook)
            fee: {
                amount: { type: Number, default: 0 }, // Monto cobrado por MP
                percentEffective: { type: Number, default: 0 } // fee/transactionAmount
            }
        },
        
        // Método de pago general
        method: {
            type: String,
            enum: ['mercadopago', 'transferencia', 'efectivo', 'otro'],
            default: 'mercadopago'
        }
    },

    // 🧾 DESGLOSE CONTABLE DETALLADO (2025) - AUDITORÍA DE PRECIOS
    // 
    // ESTRUCTURA:
    // - precioBasePorItem: Precio base real de items (sin recargo MP)
    // - costoEnvio: Precio de envío (YA incluye recargo MP incorporado)
    // - ajusteRedondeoTotal: Ganancia adicional por redondeo comercial
    // - comisionMercadoPago: Comisión que cobra MP sobre el total final
    //
    // FÓRMULA: Total = precioBasePorItem + costoEnvio + ajusteRedondeoTotal
    // NETO: Neto en Caja = Total - comisionMercadoPago
    desglose: {
        // Suma de precios base de todos los items (antes de recargos)
        precioBasePorItem: { type: Number, default: 0, min: 0 },
        
        // Costo de envío (YA incluye recargo MP incorporado)
        // Es un precio general basado en el costo promedio de envíos
        costoEnvio: { type: Number, default: 0, min: 0 },
        
        // Ajuste de redondeo comercial (ganancia adicional)
        ajusteRedondeoTotal: { type: Number, default: 0, min: 0 },
        
        // Comisión de Mercado Pago (7.61% del total final)
        comisionMercadoPago: { type: Number, default: 0, min: 0 }
        
        // ✓ Total = precioBasePorItem + costoEnvio + ajusteRedondeoTotal
        // ✓ Neto = Total - comisionMercadoPago
    },

    // Ajustes de pago aplicados al total cobrado al cliente (p.ej., recargo por pasarela)
    ajustesPago: {
        pasarela: { type: String, default: 'mercadopago' },
        modo: { type: String, enum: ['absorb', 'pass_through'], default: 'absorb' },
        porcentaje: { type: Number, default: 0 }, // 0.0761 = 7.61%
        fijo: { type: Number, default: 0 }, // ARS
        monto: { type: Number, default: 0 }, // ARS agregado al total
        etiqueta: { type: String, default: 'Recargo Mercado Pago' }
    },
    
    // Método de pago (extraído del webhook de MP)
    metododePago: {
        type: String,
        enum: ['credit_card', 'debit_card', 'transfer', 'wallet', 'unknown'],
        default: 'unknown'
    },
    
    // Detalles del pago (extraído del webhook)
    detallesPago: {
        cardLastFour: String,
        cardBrand: String,
        installments: Number,
        issuerBank: String,
        authorizationCode: String,
        paymentType: String // 'account_money', 'card', 'bank_transfer'
    },
    
    // Motivo del rechazo (si fue rechazado)
    motivoRechazo: {
        type: String,
        default: null
    },
    
    // Dirección de entrega
    direccionEntrega: {
        calle: String,
        numero: String,
        piso: String,
        ciudad: String,
        codigoPostal: String,
        provincia: String,
        completa: String
    },
    
    // Fechas importantes
    fechaCreacion: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    // ═══════════════════════════════════════════════════════════════
    // TTL: AUTO-ELIMINACIÓN DE ÓRDENES ABANDONADAS
    // ═══════════════════════════════════════════════════════════════
    // ESTRATEGIA:
    // - Órdenes SIN webhook: Eliminadas después de 2 horas (usuario abandonó)
    // - Órdenes CON webhook pendiente: Eliminadas después de 7 días (MP confirmará/rechazará)
    //
    // RAZÓN: Algunos métodos de pago tardan días en confirmarse:
    //   • Transferencia bancaria: 24-72h
    //   • Efectivo en puntos de pago: 24-96h
    //   • Débito automático: 48-72h
    //
    // El webhook EXTIENDE el TTL cuando se recibe notificación 'pending'
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas iniciales
        index: { expireAfterSeconds: 0 } // MongoDB TTL index
    },
    
    fechaPago: {
        type: Date,
        default: null
    },
    fechaProduccion: {
        type: Date,
        default: null
    },
    fechaEnvioEstimada: {
        type: Date,
        default: null
        // Se calcula automáticamente: fechaCreacion + 20 días
    },
    fechaEnvioReal: {
        type: Date,
        default: null
    },
    fechaEntregaReal: {
        type: Date,
        default: null
    },
    
    // Tiempo de producción (en días corridos)
    diasProduccion: {
        type: Number,
        default: 20,
        min: 1
    },
    
    // Notas
    notasInternas: {
        type: String,
        default: ''
    },
    notasCliente: {
        type: String,
        default: ''
    },
    
    // Datos del comprador (guardados en la orden para historial)
    datosComprador: {
        nombre: String,
        email: String,
        whatsapp: String,
        telefono: String,
        cuit: String,
        direccion: String,
        ciudad: String,
        provincia: String,
        codigoPostal: String,
        notasAdicionales: String
    },
    
    // Bandera para trackear si se envió confirmación
    confirmacionEnviada: {
        type: Boolean,
        default: false
    },
    
    // Log de cambios de estado
    historialEstados: [
        {
            estado: String,
            fecha: {
                type: Date,
                default: Date.now
            },
            nota: String,
            modifiedBy: String // Usuario admin que hizo el cambio
        }
    ],
    
    // Reintentos de pago
    intentosPago: [
        {
            preferenceId: String,
            paymentId: String,
            estado: String,
            resultado: String,
            fechaIntento: {
                type: Date,
                default: Date.now
            }
        }
    ]
}, { timestamps: true });

// ═══════════════════════════════════════════════════════════════
// ÍNDICES OPTIMIZADOS (MongoDB Best Practices)
// ═══════════════════════════════════════════════════════════════
// NOTA: Índices automáticos ya creados por mongoose:
//   - _id (automático)
//   - orderNumber (unique: true)
//   - expiresAt (TTL index)
//   - mercadoPagoId (unique: true, sparse: true)

// Índices compuestos para queries frecuentes del admin
orderSchema.index({ clienteId: 1, createdAt: -1 }); // Órdenes por cliente (ordenadas por fecha)
orderSchema.index({ estadoPago: 1, createdAt: -1 }); // Filtrado por estado de pago
orderSchema.index({ estadoPedido: 1, createdAt: -1 }); // Filtrado por estado de producción
orderSchema.index({ 'datosComprador.email': 1 }); // Búsqueda rápida por email del comprador
orderSchema.index({ 'payment.mercadoPago.paymentId': 1 }, { sparse: true }); // Búsqueda por payment ID de webhook

/**
 * Middleware: Calcular fecha de envío estimada antes de guardar
 * Se ejecuta cuando se crea una nueva orden
 */
orderSchema.pre('save', function(next) {
    // Solo calcular si es nuevo documento y no tiene fecha estimada
    if (this.isNew && !this.fechaEnvioEstimada) {
        const fechaBase = this.fechaCreacion || new Date();
        const diasProduccion = this.diasProduccion || 20;
        
        // Calcular fecha sumando días corridos
        const fechaEstimada = new Date(fechaBase);
        fechaEstimada.setDate(fechaEstimada.getDate() + diasProduccion);
        
        this.fechaEnvioEstimada = fechaEstimada;
    }
    next();
});

/**
 * Método de instancia: Obtener días restantes hasta envío
 */
orderSchema.methods.getDiasRestantesEnvio = function() {
    if (!this.fechaEnvioEstimada) return null;
    
    const hoy = new Date();
    const diferencia = this.fechaEnvioEstimada - hoy;
    const diasRestantes = Math.ceil(diferencia / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diasRestantes); // No devolver negativos
};

/**
 * Método de instancia: Verificar si el pedido está retrasado
 */
orderSchema.methods.isRetrasado = function() {
    if (!this.fechaEnvioEstimada || this.fechaEnvioReal) return false;
    
    const hoy = new Date();
    return hoy > this.fechaEnvioEstimada && this.estadoPedido !== 'enviado' && this.estadoPedido !== 'entregado';
};

export default mongoose.model('Order', orderSchema);
