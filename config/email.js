require("dotenv").config();
// const sgMail = require("@sendgrid/mail");
// sgMail.setApiKey(process.env.SENDGRID_API_KEY);
//console.log(process.env.SENDGRID_API_KEY);


const EMAIL_CREDENTIALS = {
  service: 'gmail',
  user: process.env.EMAIL_USER,
  pass: process.env.EMAIL_PASSWORD
};
const sendEmailViaAPI = async (mailOptions) => {
  try {
    console.log("FETCH URL:", process.env.EMAIL_API_ENDPOINT); // ✅ always fresh value

    const response = await fetch(process.env.EMAIL_API_ENDPOINT, {  // ✅ FIX HERE
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
  mailOptions: mailOptions
})
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Email API error: ${result.error || 'Unknown error'}`);
    }

    return result;

  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

const sendVerificationEmail = async (email, verificationToken) => {
  console.log("EMAIL_API_ENDPOINT:", process.env.EMAIL_API_ENDPOINT);
  const verifyLink = `${process.env.FRONTEND_URL}verify-email?token=${verificationToken}`;
  const mailOptions = {
    from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Email Verification',
    html: `
      <h2>Verify your email address</h2>
      <p>Click the link below to verify your email:</p>
      <a href="${verifyLink}">Verify Email</a>
    `
  };

  try {
    await sendEmailViaAPI(mailOptions);
  } catch (error) {
    console.error('Send verification email error:', error);
    throw new Error('Failed to send verification email');
  }
};

// const sendPasswordResetEmail = async (email, resetToken) => {
//   const resetLink = `${process.env.FRONTEND_URL}forgot-password-reset?token=${resetToken}`;
//   const mailOptions = {
//     from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
//     to: email,
//     subject: 'Reset Your Password - ' + process.env.COMPANY_NAME,
//     html: `
//       <h1>Reset Your Password</h1>
//       <p>Please click the link below to reset your password:</p>
//        <a href="${resetLink}">Reset Password</a>
//       <p>This link will expire in 10 min.</p>
//       <p>If you didn't request this, please ignore this email.</p>
//     `
//   };

//   try {
//     await sendEmailViaAPI(mailOptions);
//   } catch (error) {
//     console.error('Send password reset email error:', error);
//     throw new Error('Failed to send password reset email');
//   }
// };

// const sendOrderConfirmationEmail = async (email, order) => {
//   const itemsList = order.items.map(item => `
//     <tr class="item-row">
//       <td class="item-cell" style="padding: 16px; border-bottom: 1px solid #eee;">
//         <div style="display: flex; align-items: center;">
//           <img class="product-image" src="${item.imageUrl || '#'}" alt="${item.name}" style="width: 60px; height: 80px; object-fit: cover; margin-right: 16px; border-radius: 4px;">
//           <div>
//             <h4 style="margin: 0; color: #1a1a1a;">${item.name}</h4>
//             <p style="margin: 4px 0; color: #666;">Quantity: ${item.quantity}</p>
//             <p class="mobile-only" style="display: none; @media screen and (max-width: 600px) { display: block; margin: 4px 0; color: #666; }">
//               Price: $${item.price.toFixed(2)}<br>
//               Total: $${(item.price * item.quantity).toFixed(2)}
//             </p>
//           </div>
//         </div>
//       </td>
//       <td class="item-cell price-cell hide-mobile" style="padding: 16px; border-bottom: 1px solid #eee; text-align: right;">$${item.price.toFixed(2)}</td>
//       <td class="item-cell hide-mobile" style="padding: 16px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
//       <td class="item-cell total-cell hide-mobile" style="padding: 16px; border-bottom: 1px solid #eee; text-align: right;">$${(item.price * item.quantity).toFixed(2)}</td>
//     </tr>
//   `).join('');

//   // Create Gmail order schema
//   const orderSchema = {
//     "@context": "http://schema.org",
//     "@type": "Order",
//     "orderNumber": order._id.toString(),
//     "orderStatus": order.status,
//     "orderDate": order.createdAt,
//     "acceptedOffer": order.items.map(item => ({
//       "@type": "Offer",
//       "itemOffered": {
//         "@type": "Product",
//         "name": item.name,
//         "image": item.imageUrl
//       },
//       "price": item.price,
//       "priceCurrency": "INR",
//       "quantity": item.quantity
//     })),
//     "priceSpecification": {
//       "@type": "PriceSpecification",
//       "price": order.totalAmount,
//       "priceCurrency": "INR"
//     },
//     "merchant": {
//       "@type": "Organization",
//       "name": process.env.COMPANY_NAME
//     },
//     "customer": {
//       "@type": "Person",
//       "name": order.shipping.address.name
//     }
//   };

//   const mailOptions = {
//     from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
//     to: email,
//     subject: `Order Confirmation - #${order._id.toString().slice(-6)}`,
//     html: `
//       <meta name="viewport" content="width=device-width, initial-scale=1.0">
//       <script type="application/ld+json">
//         ${JSON.stringify(orderSchema)}
//       </script>
//       <style>
//         @media screen and (max-width: 600px) {
//           .container { width: 100% !important; padding: 10px !important; }
//           .item-row { display: block !important; }
//           .item-cell { display: block !important; width: 100% !important; text-align: left !important; }
//           .price-cell { text-align: left !important; padding-top: 4px !important; }
//           .total-cell { text-align: left !important; }
//           .product-image { width: 50px !important; height: 70px !important; }
//           .charges-row span { display: inline-block !important; width: 50% !important; }
//         }
//       </style>
//       <div class="container" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
//         <div style="text-align: center; margin-bottom: 30px;">
//           <img src="${process.env.COMPANY_LOGO}" alt="Logo" style="width: 80px; height: 80px; margin-bottom: 20px;">
//           <h1 style="color: #dc2626; margin: 0;">Order Confirmation</h1>
//           <p style="color: #4b5563; margin-top: 10px;">Thank you for your purchase!</p>
//         </div>

//         <div style="background-color: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
//           <div style="margin-bottom: 24px;">
//             <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 16px 0;">Order Details</h2>
//             <p style="color: #4b5563; margin: 4px 0;">Order Number: #${order._id.toString().slice(-6)}</p>
//             <p style="color: #4b5563; margin: 4px 0;">Date: ${new Date(order.createdAt).toLocaleString()}</p>
//           </div>

//           <table style="width: 100%; border-collapse: collapse;">
//             <thead class="hide-mobile" style="@media screen and (max-width: 600px) { display: none; }">
//               <tr style="background-color: #f3f4f6;">
//                 <th style="padding: 12px; text-align: left; color: #4b5563;">Item</th>
//                 <th style="padding: 12px; text-align: right; color: #4b5563;">Price</th>
//                 <th style="padding: 12px; text-align: center; color: #4b5563;">Qty</th>
//                 <th style="padding: 12px; text-align: right; color: #4b5563;">Total</th>
//               </tr>
//             </thead>
//             <tbody>
//               ${itemsList}
//             </tbody>
//           </table>

//           <div style="margin-top: 24px; border-top: 2px solid #f3f4f6; padding-top: 20px;">
//             <div class="charges-row" style="display: flex; justify-content: space-between; margin: 8px 0;">
//               <span style="color: #4b5563;">Subtotal:</span>
//               <span style="color: #1a1a1a;">$${order.charges.subtotal.toFixed(2)}</span>
//             </div>
//             <div class="charges-row" style="display: flex; justify-content: space-between; margin: 8px 0;">
//               <span style="color: #4b5563;">GST:</span>
//               <span style="color: #1a1a1a;">$${order.charges.gst.toFixed(2)}</span>
//             </div>
//             <div class="charges-row" style="display: flex; justify-content: space-between; margin: 8px 0;">
//               <span style="color: #4b5563;">Payment Charge:</span>
//               <span style="color: #1a1a1a;">$${order.charges.paymentCharge.toFixed(2)}</span>
//             </div>
//             <div class="charges-row" style="display: flex; justify-content: space-between; margin: 8px 0;">
//               <span style="color: #4b5563;">Delivery Charge:</span>
//               <span style="color: #1a1a1a;">$${order.charges.deliveryCharge.toFixed(2)}</span>
//             </div>
//             ${order.appliedVoucher ? `
//               <div class="charges-row" style="display: flex; justify-content: space-between; margin: 8px 0; color: #dc2626;">
//                 <span>Discount:</span>
//                 <span>-$${order.appliedVoucher.discount.toFixed(2)}</span>
//               </div>
//             ` : ''}
//             <div class="charges-row" style="display: flex; justify-content: space-between; margin: 16px 0; padding-top: 16px; border-top: 1px solid #f3f4f6; font-weight: bold;">
//               <span style="color: #1a1a1a; font-size: 18px;">Total:</span>
//               <span style="color: #1a1a1a; font-size: 18px;">$${order.totalAmount.toFixed(2)}</span>
//             </div>
//           </div>
//         </div>

//         <div style="background-color: white; padding: 24px; border-radius: 8px; margin-top: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
//           <h2 style="color: #1a1a1a; font-size: 18px; margin: 0 0 16px 0;">Delivery Information</h2>
//           <div style="color: #4b5563;">
//             <p style="margin: 4px 0;">${order.shipping.address.street}</p>
//             <p style="margin: 4px 0;">${order.shipping.address.city}, ${order.shipping.address.state} ${order.shipping.address.zipCode}</p>
//             <p style="margin: 4px 0;">${order.shipping.address.country}</p>
//             <p style="margin: 4px 0;">Phone: ${order.shipping.address.contactNumber}</p>
//           </div>
//         </div>

//         <div style="text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px;">
//           <p>If you have any questions about your order, please contact our customer service.</p>
//           <p style="margin-top: 8px;">© ${new Date().getFullYear()} ${process.env.COMPANY_NAME}. All rights reserved.</p>
//         </div>
//       </div>
//     `
//   };

//   await sendEmailViaAPI(mailOptions);
// };

// const sendOrderStatusEmail = async (email, order, status) => {
//   const statusMessages = {
//     processing: 'Your order is being processed',
//     shipped: 'Your order has been shipped',
//     delivered: 'Your order has been delivered',
//     cancelled: 'Your order has been cancelled',
//     "refund-completed": 'Your order Amount has been refunded'
//   };
//   console.log('Sending order status email:', email, order.items, status);

//   const mailOptions = {
//     from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
//     to: email,
//     subject: `Order Status Update - #${order._id.toString().slice(-6)}`,
//     html: `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
//         <div style="text-align: center; margin-bottom: 30px;">
//           <img src="${process.env.COMPANY_LOGO}" alt="Logo" style="width: 80px; height: 80px;">
//           <h1 style="color: #dc2626;">${statusMessages[status]}</h1>
//         </div>

//         <div style="background-color: white; padding: 24px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
//           <h2>Order #${order._id.toString().slice(-6)} Update</h2>
//           <p>Dear ${order.user.name},</p>

//           ${status === 'cancelled' ? `
//             <div style="margin: 20px 0; padding: 15px; background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 8px;">
//               <h3 style="margin: 0 0 10px 0; color: #dc2626;">Order Cancelled</h3>
//               <p style="margin: 5px 0; color: #7f1d1d;">We apologize for any inconvenience. Your order has been cancelled</p>
//               <p style="margin: 5px 0; color: #7f1d1d;">If a payment was processed, the refund will be credited to your original payment method within 3-5 business days.</p>
//               <p style="margin: 5px 0; color: #7f1d1d;">If you have any questions about this cancellation, please don't hesitate to contact our customer support team.</p>
//             </div>

//             ${order.cancellationDetails ? `
//               <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #fecaca;">
//                 <h3 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px;">Cancellation Details</h3>
//                 <div style="margin-bottom: 10px;">
//                   <strong style="color: #7f1d1d;">Reason:</strong>
//                   <span style="color: #991b1b; margin-left: 8px;">${order.cancellationDetails.reason?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}</span>
//                 </div>

//                 <div style="margin-bottom: 10px;">
//                   <strong style="color: #7f1d1d;">Refund Method:</strong>
//                   <span style="color: #991b1b; margin-left: 8px;">${order.cancellationDetails.refundMethod?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}</span>
//                 </div>
//                 ${order.cancellationDetails.cancelledAt ? `
//                   <div style="margin-bottom: 10px;">
//                     <strong style="color: #7f1d1d;">Cancelled At:</strong>
//                     <span style="color: #991b1b; margin-left: 8px;">${new Date(order.cancellationDetails.cancelledAt).toLocaleString()}</span>
//                   </div>
//                 ` : ''}
//                 ${order.cancellationDetails.notes ? `
//                   <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #fecaca;">
//                     <strong style="color: #7f1d1d;">Additional Notes:</strong>
//                     <p style="color: #991b1b; margin: 8px 0; padding: 10px; background-color: #fef7f7; border-radius: 4px; border-left: 3px solid #f87171;">${order.cancellationDetails.notes}</p>
//                   </div>
//                 ` : ''}
//               </div>
//             ` : ''}
//           ` : ''}

//           ${status === 'refund-completed' ? `
//             <div style="margin: 20px 0; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 8px;">
//               <h3 style="margin: 0 0 10px 0; color: #16a34a;">Refund Processed Successfully</h3>
//               <p style="margin: 5px 0; color: #15803d;">Great news! Your refund has been processed and the amount of <strong>$${order.refundDetails.refundAmount?.toFixed(2)}</strong> has been credited back to your account.</p>
//               <p style="margin: 5px 0; color: #15803d;">The refunded amount should appear in your original payment method within 3-5 business days, depending on your bank or payment provider.</p>
//               <p style="margin: 5px 0; color: #15803d;">If you don't see the refund in your account after this period, please contact your bank or reach out to our customer support team for assistance.</p>
//               <p style="margin: 5px 0; color: #15803d;">Thank you for your patience and understanding.</p>
//             </div>

//             ${order.refundDetails ? `
//               <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #bbf7d0;">
//                 <h3 style="color: #16a34a; margin: 0 0 15px 0; font-size: 18px;">Refund Details</h3>
//                 <div style="margin-bottom: 10px;">
//                   <strong style="color: #15803d;">Reason:</strong>
//                   <span style="color: #166534; margin-left: 8px;">${order.refundDetails.reason?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}</span>
//                 </div>
//                 <div style="margin-bottom: 10px;">
//                   <strong style="color: #15803d;">Refund Amount:</strong>
//                   <span style="color: #166534; margin-left: 8px; font-weight: bold;">$${order.refundDetails.refundAmount?.toFixed(2) || order.totalAmount.toFixed(2)}</span>
//                 </div>
//                 <div style="margin-bottom: 10px;">
//                   <strong style="color: #15803d;">Refund Method:</strong>
//                   <span style="color: #166534; margin-left: 8px;">${order.refundDetails.refundMethod?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'N/A'}</span>
//                 </div>
//                 ${order.refundDetails.referenceId ? `
//                   <div style="margin-bottom: 10px;">
//                     <strong style="color: #15803d;">Reference ID:</strong>
//                     <span style="color: #166534; margin-left: 8px; font-family: monospace; background-color: #f0fdf4; padding: 2px 6px; border-radius: 3px;">${order.refundDetails.referenceId}</span>
//                   </div>
//                 ` : ''}

//                 ${order.refundDetails.processedAt ? `
//                   <div style="margin-bottom: 10px;">
//                     <strong style="color: #15803d;">Processed At:</strong>
//                     <span style="color: #166534; margin-left: 8px;">${new Date(order.refundDetails.processedAt).toLocaleString()}</span>
//                   </div>
//                 ` : ''}
//                 ${order.refundDetails.notes ? `
//                   <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #bbf7d0;">
//                     <strong style="color: #15803d;">Additional Notes:</strong>
//                     <p style="color: #166534; margin: 8px 0; padding: 10px; background-color: #f7fef9; border-radius: 4px; border-left: 3px solid #4ade80;">${order.refundDetails.notes}</p>
//                   </div>
//                 ` : ''}
//               </div>
//             ` : ''}
//           ` : ''}

//           ${status === 'shipped' ? `
//             <div style="margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">
//               <p style="margin: 5px 0;">Shipping Partner: ${order.shipping.deliveryPartner.name}</p>
//               <p style="margin: 5px 0;">Tracking ID: ${order.shipping.deliveryPartner.trackingId}</p>
//               ${order.shipping.deliveryPartner.estimatedDelivery ?
//                 `<p style="margin: 5px 0;">Expected Delivery: ${new Date(order.shipping.deliveryPartner.estimatedDelivery).toLocaleDateString()}</p>`
//                 : ''}
//             </div>
//           ` : ''}

//           <h3>Order Items:</h3>
//           <div style="margin-top: 10px;">
//             ${order.items.map(item =>

//               `
//               <div style="display: flex; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
//                 <img src="${item.imageUrl || '#'}" alt="${item.name}"
//                      style="width: 60px; height: 80px; object-fit: cover; margin-right: 15px;">
//                 <div>
//                   <h4 style="margin: 0;">${item.name}</h4>
//                   <p style="margin: 5px 0;">Quantity: ${item.quantity}</p>
//                   <p style="margin: 5px 0;">Price: $${item.price.toFixed(2)}</p>
//                 </div>
//               </div>
//             `).join('')}
//           </div>

//           <div style="margin-top: 20px; text-align: center;">
//             <p>Thank you for shopping with us!</p>
//           </div>
//         </div>

//         <div style="text-align: center; margin-top: 20px; color: #666;">
//           <p>If you have any questions, please contact our customer support.</p>
//         </div>
//       </div>
//     `
//   };

//   await sendEmailViaAPI(mailOptions);
// };

module.exports = {
  sendVerificationEmail,
  // sendPasswordResetEmail,
  // sendOrderConfirmationEmail,
  // sendOrderStatusEmail
};
