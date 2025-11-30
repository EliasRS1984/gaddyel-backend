import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
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
    
    // Totales
    total: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Estados de pago (Mercado Pago)
    estadoPago: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled'],
        default: 'pending'
    },
    
    // Estados del pedido (Interno)
    estadoPedido: {
        type: String,
        enum: ['pendiente', 'en_produccion', 'listo', 'enviado', 'entregado', 'cancelado'],
        default: 'pendiente'
    },
    
    // Integración Mercado Pago
    mercadoPagoId: {
        type: String,
        unique: true,
        sparse: true // Permite null/undefined sin error
    },
    mercadoPagoPaymentId: {
        type: String,
        sparse: true
    },
    
    // URLs de Mercado Pago
    mercadoPagoCheckoutUrl: {
        type: String
    },
    
    // Fechas importantes
    fechaCreacion: {
        type: Date,
        default: Date.now
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
    
    // Datos del comprador (guardados en la orden)
    datosComprador: {
        nombre: String,
        email: String,
        whatsapp: String
    },
    
    // Log de cambios
    historialEstados: [
        {
            estado: String,
            fecha: {
                type: Date,
                default: Date.now
            },
            nota: String
        }
    ]
}, { timestamps: true });

// Índices para búsquedas rápidas
orderSchema.index({ clienteId: 1 });
orderSchema.index({ estadoPago: 1 });
orderSchema.index({ estadoPedido: 1 });
// mercadoPagoId ya tiene unique: true que crea índice automático
orderSchema.index({ fechaCreacion: -1 });

export default mongoose.model('Order', orderSchema);
