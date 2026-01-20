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
    
    // Estados de pago (Mercado Pago)
    estadoPago: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired', 'refunded'],
        default: 'pending'
    },
    
    // Estados del pedido (Interno)
    estadoPedido: {
        type: String,
        enum: ['pendiente', 'en_produccion', 'listo', 'enviado', 'entregado', 'cancelado'],
        default: 'pendiente'
    },
    
    // ===== MERCADO PAGO (LEGACY - Mantener por compatibilidad) =====
    mercadoPagoId: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    mercadoPagoPaymentId: {
        type: String,
        sparse: true,
        index: true
    },
    
    // URL de checkout de Mercado Pago
    mercadoPagoCheckoutUrl: {
        type: String
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

// Índices para búsquedas rápidas
orderSchema.index({ clienteId: 1, fechaCreacion: -1 });
orderSchema.index({ estadoPago: 1, fechaCreacion: -1 });
orderSchema.index({ estadoPedido: 1, fechaCreacion: -1 });
// orderNumber ya tiene unique: true e index: true que crea índice automático
// mercadoPagoId ya tiene unique: true que crea índice automático
orderSchema.index({ 'datosComprador.email': 1 });

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

// ✅ Índices compuestos para mejorar performance de queries
orderSchema.index({ clienteId: 1, createdAt: -1 }); // Query común: órdenes por cliente
orderSchema.index({ estadoPago: 1 }); // Filtrado por estado de pago
orderSchema.index({ estadoPedido: 1, createdAt: -1 }); // Filtrado por estado de pedido
// orderNumber ya tiene unique: true que crea índice automático

export default mongoose.model('Order', orderSchema);
