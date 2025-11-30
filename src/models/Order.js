import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    // Número de orden único e incremental (formato: #000001)
    orderNumber: {
        type: String,
        unique: true,
        sparse: true,
        index: true
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
                ref: 'Product',
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
    
    // Estados de pago (Mercado Pago)
    estadoPago: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled', 'expired', 'refunded'],
        default: 'pending',
        index: true
    },
    
    // Estados del pedido (Interno)
    estadoPedido: {
        type: String,
        enum: ['pendiente', 'en_produccion', 'listo', 'enviado', 'entregado', 'cancelado'],
        default: 'pendiente',
        index: true
    },
    
    // Integración Mercado Pago
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
    fechaEntregaEstimada: {
        type: Date
    },
    fechaEntregaReal: {
        type: Date,
        default: null
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
        cuit: String
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

export default mongoose.model('Order', orderSchema);
