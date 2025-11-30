/**
 * Service: Email
 * Descripción: Servicio para envío de correos electrónicos
 * Propósito: Confirmaciones de pago, notificaciones de orden, recuperación de contraseña
 */

const nodemailer = require('nodemailer');
const { logAudit } = require('../utils/logger');

class EmailService {
  /**
   * Configurar transportador de correo
   */
  static getTransporter() {
    if (process.env.NODE_ENV === 'development' || !process.env.SMTP_HOST) {
      // En desarrollo usar ethereal (fake email service)
      return {
        sendMail: async (options) => {
          console.log('[EMAIL] Simulated email:');
          console.log(`To: ${options.to}`);
          console.log(`Subject: ${options.subject}`);
          console.log(`Body: ${options.html?.substring(0, 100)}...`);
          return { messageId: 'dev-mock-id' };
        },
      };
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true para port 465, false para otros puertos
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Enviar confirmación de orden
   * @param {Object} orderData - Datos de la orden
   */
  static async sendOrderConfirmation(orderData) {
    try {
      const { customer, orderNumber, items, total } = orderData;

      const itemsHTML = items
        .map(
          (item) =>
            `
        <tr>
          <td>${item.productName}</td>
          <td>${item.quantity}</td>
          <td>$${item.price.toFixed(2)}</td>
          <td>$${(item.price * item.quantity).toFixed(2)}</td>
        </tr>
      `
        )
        .join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; }
              .header { background: #333; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; }
              .items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
              .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
              .items-table th { background: #f0f0f0; }
              .total { font-size: 18px; font-weight: bold; margin-top: 20px; }
              .footer { background: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Gaddyel - Confirmación de Orden</h1>
              </div>
              <div class="content">
                <p>Hola <strong>${customer.name}</strong>,</p>
                <p>¡Gracias por tu compra! Tu orden ha sido creada exitosamente.</p>
                
                <h3>Número de Orden: <strong>#${orderNumber}</strong></h3>
                
                <h3>Detalles de la Orden:</h3>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Cantidad</th>
                      <th>Precio</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHTML}
                  </tbody>
                </table>
                
                <div class="total">
                  Total a Pagar: $${total.toFixed(2)}
                </div>
                
                <p>Próximo paso: Dirígete al checkout para completar el pago.</p>
                <p>Si tienes dudas, contacta a nuestro equipo de soporte.</p>
                
                <p>¡Gracias por tu confianza!</p>
              </div>
              <div class="footer">
                <p>&copy; 2024 Gaddyel. Todos los derechos reservados.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@gaddyel.com',
        to: customer.email,
        subject: `Confirmación de Orden #${orderNumber} - Gaddyel`,
        html,
      });

      logAudit('EMAIL_SENT', { type: 'order_confirmation', orderNumber, customerEmail: customer.email }, 'INFO');
    } catch (error) {
      logAudit('EMAIL_SEND_ERROR', { type: 'order_confirmation', error: error.message }, 'ERROR');
      // No lanzar excepción, solo loguear
    }
  }

  /**
   * Enviar confirmación de pago
   * @param {Object} paymentData - Datos del pago
   */
  static async sendPaymentConfirmation(paymentData) {
    try {
      const { customer, orderNumber, amount, paymentId, paymentMethod } = paymentData;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; }
              .header { background: #27ae60; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; }
              .success-badge { background: #27ae60; color: white; padding: 15px; border-radius: 5px; text-align: center; font-size: 18px; font-weight: bold; margin: 20px 0; }
              .info-box { background: #ecf0f1; padding: 15px; border-left: 4px solid #27ae60; margin: 20px 0; }
              .footer { background: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Pago Confirmado</h1>
              </div>
              <div class="content">
                <p>Hola <strong>${customer.name}</strong>,</p>
                
                <div class="success-badge">
                  ✓ Tu pago ha sido procesado exitosamente
                </div>
                
                <div class="info-box">
                  <p><strong>Número de Orden:</strong> #${orderNumber}</p>
                  <p><strong>Monto Pagado:</strong> $${amount.toFixed(2)}</p>
                  <p><strong>Método de Pago:</strong> ${paymentMethod}</p>
                  <p><strong>ID de Transacción:</strong> ${paymentId}</p>
                  <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-AR')}</p>
                </div>
                
                <p>Pronto recibirás actualizaciones sobre el estado de tu envío.</p>
                <p>Puedes rastrear tu orden en cualquier momento visitando tu cuenta.</p>
                
                <p>¡Gracias por tu compra!</p>
              </div>
              <div class="footer">
                <p>&copy; 2024 Gaddyel. Todos los derechos reservados.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@gaddyel.com',
        to: customer.email,
        subject: `Pago Confirmado - Orden #${orderNumber}`,
        html,
      });

      logAudit('EMAIL_SENT', { type: 'payment_confirmation', orderNumber, customerEmail: customer.email }, 'INFO');
    } catch (error) {
      logAudit('EMAIL_SEND_ERROR', { type: 'payment_confirmation', error: error.message }, 'ERROR');
    }
  }

  /**
   * Enviar notificación de pago rechazado
   * @param {Object} paymentData - Datos del pago
   */
  static async sendPaymentRejected(paymentData) {
    try {
      const { customer, orderNumber, reason } = paymentData;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; }
              .header { background: #e74c3c; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; }
              .warning-box { background: #fadbd8; border-left: 4px solid #e74c3c; padding: 15px; margin: 20px 0; }
              .retry-button { display: inline-block; background: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px; }
              .footer { background: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Pago No Procesado</h1>
              </div>
              <div class="content">
                <p>Hola <strong>${customer.name}</strong>,</p>
                
                <div class="warning-box">
                  <p><strong>Tu pago ha sido rechazado.</strong></p>
                  <p>Razón: ${reason}</p>
                </div>
                
                <p>No te preocupes, tu orden sigue reservada. Puedes intentar pagar nuevamente dentro de las próximas 24 horas.</p>
                
                <p><strong>Número de Orden:</strong> #${orderNumber}</p>
                
                <p><strong>Posibles razones del rechazo:</strong></p>
                <ul>
                  <li>Fondos insuficientes</li>
                  <li>Tarjeta vencida o datos incorrectos</li>
                  <li>Transacción bloqueada por seguridad</li>
                  <li>Límite de transacciones excedido</li>
                </ul>
                
                <p>Contacta a tu banco si crees que es un error, o intenta con otro método de pago.</p>
                
                <a href="${process.env.FRONTEND_URL}/checkout/retry/${orderNumber}" class="retry-button">Reintentar Pago</a>
              </div>
              <div class="footer">
                <p>&copy; 2024 Gaddyel. Todos los derechos reservados.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@gaddyel.com',
        to: customer.email,
        subject: `Pago Rechazado - Orden #${orderNumber}`,
        html,
      });

      logAudit('EMAIL_SENT', { type: 'payment_rejected', orderNumber, customerEmail: customer.email }, 'INFO');
    } catch (error) {
      logAudit('EMAIL_SEND_ERROR', { type: 'payment_rejected', error: error.message }, 'ERROR');
    }
  }

  /**
   * Enviar notificación de reembolso procesado
   * @param {Object} refundData - Datos del reembolso
   */
  static async sendRefundNotification(refundData) {
    try {
      const { customer, orderNumber, amount, refundId } = refundData;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; }
              .header { background: #f39c12; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; }
              .info-box { background: #fef5e7; border-left: 4px solid #f39c12; padding: 15px; margin: 20px 0; }
              .footer { background: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Reembolso Procesado</h1>
              </div>
              <div class="content">
                <p>Hola <strong>${customer.name}</strong>,</p>
                
                <p>Tu solicitud de reembolso ha sido procesada exitosamente.</p>
                
                <div class="info-box">
                  <p><strong>Número de Orden:</strong> #${orderNumber}</p>
                  <p><strong>Monto Reembolsado:</strong> $${amount.toFixed(2)}</p>
                  <p><strong>ID de Reembolso:</strong> ${refundId}</p>
                  <p><strong>Fecha de Procesamiento:</strong> ${new Date().toLocaleDateString('es-AR')}</p>
                </div>
                
                <p>El dinero será acreditado a tu cuenta en 3-5 días hábiles, según tu banco.</p>
                
                <p>Gracias y esperamos verte pronto nuevamente.</p>
              </div>
              <div class="footer">
                <p>&copy; 2024 Gaddyel. Todos los derechos reservados.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@gaddyel.com',
        to: customer.email,
        subject: `Reembolso Procesado - Orden #${orderNumber}`,
        html,
      });

      logAudit('EMAIL_SENT', { type: 'refund_notification', orderNumber, customerEmail: customer.email }, 'INFO');
    } catch (error) {
      logAudit('EMAIL_SEND_ERROR', { type: 'refund_notification', error: error.message }, 'ERROR');
    }
  }

  /**
   * Enviar notificación de actualización de estado de envío
   * @param {Object} shipmentData - Datos del envío
   */
  static async sendShipmentNotification(shipmentData) {
    try {
      const { customer, orderNumber, status, trackingNumber } = shipmentData;

      const statusMessages = {
        processing: 'Tu orden está siendo preparada',
        shipped: 'Tu orden ha sido enviada',
        delivered: 'Tu orden ha sido entregada',
      };

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; }
              .header { background: #2980b9; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; }
              .status-box { background: #d6eaf8; border-left: 4px solid #2980b9; padding: 15px; margin: 20px 0; }
              .footer { background: #f0f0f0; padding: 10px; text-align: center; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Actualización de Envío</h1>
              </div>
              <div class="content">
                <p>Hola <strong>${customer.name}</strong>,</p>
                
                <div class="status-box">
                  <p><strong>${statusMessages[status] || 'Tu orden ha sido actualizada'}</strong></p>
                  <p><strong>Número de Orden:</strong> #${orderNumber}</p>
                  ${trackingNumber ? `<p><strong>Número de Seguimiento:</strong> ${trackingNumber}</p>` : ''}
                </div>
                
                <p>Puedes rastrear tu pedido en tiempo real usando tu número de seguimiento.</p>
              </div>
              <div class="footer">
                <p>&copy; 2024 Gaddyel. Todos los derechos reservados.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@gaddyel.com',
        to: customer.email,
        subject: `Actualización de Envío - Orden #${orderNumber}`,
        html,
      });

      logAudit('EMAIL_SENT', { type: 'shipment_update', orderNumber, status, customerEmail: customer.email }, 'INFO');
    } catch (error) {
      logAudit('EMAIL_SEND_ERROR', { type: 'shipment_update', error: error.message }, 'ERROR');
    }
  }
}

module.exports = EmailService;
