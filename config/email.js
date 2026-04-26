require("dotenv").config();

// ✅ API endpoint (backend URL)
const EMAIL_API_ENDPOINT = process.env.EMAIL_API_ENDPOINT;

// ✅ Send email via your backend API (NO credentials here)
const sendEmailViaAPI = async (mailOptions) => {
  try {
    const response = await fetch(EMAIL_API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mailOptions }), // ✅ ONLY mailOptions
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Email API error");
    }

    return result;

  } catch (error) {
    console.error("Email sending failed:", error.message);
    throw new Error("Failed to send email");
  }
};

// ✅ Verification email function
const sendVerificationEmail = async (email, verificationToken) => {
  const verifyLink = `${process.env.BASE_URL}verify-email?token=${verificationToken}`;

  const mailOptions = {
    from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Email Verification",
    html: `
      <h2>Verify your email address</h2>
      <p>Click the link below to verify your email:</p>
      <a href="${verifyLink}">Verify Email</a>
    `,
  };

  try {
    await sendEmailViaAPI(mailOptions);
  } catch (error) {
    console.error("Send verification email error:", error.message);
    throw new Error("Failed to send verification email");
  }
};
const sendPasswordResetEmail = async (email, resetToken) => {
  const mailOptions = {
    from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Reset Your Password - ' + process.env.COMPANY_NAME,
    html: `
      <h1>Reset Your Password</h1>
      <p>Please click the link below to reset your password:</p>
      <a href="${process.env.BASE_URL}forgot-password-reset?token=${resetToken}">
        Reset Password
      </a>
      <p>This link will expire in 10 min.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `
  };

  try {
    await sendEmailViaAPI(mailOptions);
  } catch (error) {
    console.error('Send password reset email error:', error);
    throw new Error('Failed to send password reset email');
  }
};

const sendOrderConfirmationEmail = async (email, order) => {
  try {
    const itemsList = order.items.map(item => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">
          <img src="${item.imageUrl || ''}" alt="${item.name}" 
               style="width: 50px; height: 70px; object-fit: cover; margin-right: 10px;" />
          <div>
            <strong>${item.name}</strong><br/>
            Qty: ${item.quantity}
          </div>
        </td>
        <td style="text-align:right;">₹${(item.price || 0).toFixed(2)}</td>
        <td style="text-align:center;">${item.quantity}</td>
        <td style="text-align:right;">₹${((item.price || 0) * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    const orderSchema = {
      "@context": "http://schema.org",
      "@type": "Order",
      orderNumber: order._id?.toString(),
      orderStatus: order.status,
      orderDate: order.createdAt,
      priceCurrency: "INR",
      price: order.totalAmount,
      merchant: {
        "@type": "Organization",
        name: process.env.COMPANY_NAME
      }
    };

    const mailOptions = {
      from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Order Confirmation - #${order._id.toString().slice(-6)}`,
      html: `
        <script type="application/ld+json">
          ${JSON.stringify(orderSchema)}
        </script>

        <div style="font-family: Arial; max-width:600px; margin:auto; padding:20px; background:#f9fafb;">
          
          <div style="text-align:center;">
            <img src="${process.env.COMPANY_LOGO}" style="width:70px;" />
            <h2>Order Confirmation</h2>
            <p>Thank you for your purchase!</p>
          </div>

          <div style="background:white; padding:20px; border-radius:8px;">
            <p><strong>Order ID:</strong> #${order._id.toString().slice(-6)}</p>
            <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>

            <table style="width:100%; border-collapse:collapse;">
              <thead>
                <tr style="background:#f3f4f6;">
                  <th align="left">Item</th>
                  <th align="right">Price</th>
                  <th align="center">Qty</th>
                  <th align="right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsList}
              </tbody>
            </table>

            <hr/>

            <p>Subtotal: ₹${(order.charges?.subtotal || 0).toFixed(2)}</p>
            <p>GST: ₹${(order.charges?.gst || 0).toFixed(2)}</p>
            <p>Delivery: ₹${(order.charges?.deliveryCharge || 0).toFixed(2)}</p>

            ${order.appliedVoucher ? `
              <p style="color:red;">Discount: -₹${order.appliedVoucher.discount.toFixed(2)}</p>
            ` : ''}

            <h3>Total: ₹${(order.totalAmount || 0).toFixed(2)}</h3>
          </div>

          <div style="background:white; padding:20px; margin-top:20px;">
            <h3>Delivery Address</h3>
            <p>${order.shipping?.address?.street || ''}</p>
            <p>${order.shipping?.address?.city || ''}, ${order.shipping?.address?.state || ''}</p>
            <p>${order.shipping?.address?.country || ''}</p>
            <p>Phone: ${order.shipping?.address?.contactNumber || ''}</p>
          </div>

          <p style="text-align:center; font-size:12px; color:#777;">
            © ${new Date().getFullYear()} ${process.env.COMPANY_NAME}
          </p>
        </div>
      `
    };

    await sendEmailViaAPI(mailOptions);

  } catch (error) {
    console.error("Order email error:", error.message);
    throw new Error("Failed to send order confirmation email");
  }
};

const sendOrderStatusEmail = async (email, order, status) => {
  try {
    const statusMessages = {
      processing: 'Your order is being processed',
      shipped: 'Your order has been shipped',
      delivered: 'Your order has been delivered',
      cancelled: 'Your order has been cancelled',
      "refund-completed": 'Your order amount has been refunded'
    };

    const message = statusMessages[status] || "Order status updated";

    const itemsHTML = (order.items || []).map(item => `
      <div style="margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
        <img src="${item.imageUrl || ''}" 
             alt="${item.name}" 
             style="width: 60px; height: 80px; object-fit: cover; margin-right: 10px;">
        <div>
          <p style="margin: 0; font-weight: bold;">${item.name}</p>
          <p style="margin: 5px 0;">Qty: ${item.quantity}</p>
          <p style="margin: 5px 0;">Price: ₹${(item.price || 0).toFixed(2)}</p>
        </div>
      </div>
    `).join('');

    const mailOptions = {
      from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Order Update - #${order._id.toString().slice(-6)}`,
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px;">
          
          <div style="text-align: center;">
            <img src="${process.env.COMPANY_LOGO}" style="width: 80px;" />
            <h2 style="color: #dc2626;">${message}</h2>
          </div>

          <p>Hi ${order?.user?.name || "Customer"},</p>

          <p><strong>Order ID:</strong> #${order._id.toString().slice(-6)}</p>

          ${
            status === 'cancelled'
              ? `
                <div style="background: #fee2e2; padding: 15px; border-radius: 6px;">
                  <p>Your order has been cancelled.</p>
                  <p>Refund will be processed within 3–5 days.</p>
                </div>
              `
              : ''
          }

          ${
            status === 'refund-completed'
              ? `
                <div style="background: #dcfce7; padding: 15px; border-radius: 6px;">
                  <p>Refund processed successfully.</p>
                  <p>Amount: ₹${(order?.refundDetails?.refundAmount || order.totalAmount || 0).toFixed(2)}</p>
                </div>
              `
              : ''
          }

          ${
            status === 'shipped'
              ? `
                <div style="background: #f3f4f6; padding: 15px; border-radius: 6px;">
                  <p>Shipping Partner: ${order?.shipping?.deliveryPartner?.name || "N/A"}</p>
                  <p>Tracking ID: ${order?.shipping?.deliveryPartner?.trackingId || "N/A"}</p>
                </div>
              `
              : ''
          }

          <h3 style="margin-top: 20px;">Items:</h3>
          ${itemsHTML}

          <h3>Total: ₹${(order.totalAmount || 0).toFixed(2)}</h3>

          <p style="margin-top: 20px;">Thank you for shopping with us ❤️</p>

          <p style="font-size: 12px; color: #777;">
            Need help? Contact our support team.
          </p>

        </div>
      `
    };

    await sendEmailViaAPI(mailOptions);

  } catch (error) {
    console.error("Order status email error:", error.message);
    throw new Error("Failed to send order status email");
  }
};

const sendAppointmentConfirmationEmail = async (email, appointment) => {
  try {
    const appointmentDate = new Date(appointment.dateOfAppointment).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });

    const mailOptions = {
      from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Appointment Confirmed - ${process.env.COMPANY_NAME}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; background-color: #f9fafb;">
          
          <!-- HEADER -->
          <div style="text-align: center; margin-bottom: 25px;">
            <img src="${process.env.COMPANY_LOGO}" alt="Logo" style="width: 80px; margin-bottom: 10px;" />
            <h1 style="color: #16a34a; margin: 0;">Appointment Confirmed</h1>
            <p style="color: #555;">Your booking has been successfully scheduled</p>
          </div>

          <!-- MAIN CARD -->
          <div style="background: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);">
            
            <p>Hi <strong>${appointment.name}</strong>,</p>

            <p style="color: #555;">
              Thank you for booking your appointment with <strong>${process.env.COMPANY_NAME}</strong>.
              Here are your appointment details:
            </p>

            <!-- DETAILS -->
            <div style="margin: 15px 0; line-height: 1.6;">
              <p><strong>Appointment ID:</strong> #${appointment._id.toString().slice(-6)}</p>
              <p><strong>Service:</strong> ${appointment.service}</p>
              <p><strong>Pet Category:</strong> ${appointment.petCategory}</p>
              <p><strong>Date:</strong> ${appointmentDate}</p>
              <p><strong>Time:</strong> ${appointment.time}</p>
              <p><strong>Location:</strong> ${appointment.location}</p>
              <p><strong>Contact:</strong> ${appointment.phone}</p>
            </div>

            <!-- NOTE -->
            <div style="background: #ecfdf5; padding: 12px; border-left: 4px solid #16a34a; border-radius: 6px; margin-top: 15px;">
              <p style="margin: 0; color: #065f46;">
                Please arrive at least <strong>10 minutes early</strong> for your appointment.
              </p>
            </div>

          </div>

          <!-- FOOTER -->
          <div style="text-align: center; margin-top: 25px; font-size: 13px; color: #777;">
            <p>If you need to reschedule or cancel, please contact our support team.</p>
            <p>© ${new Date().getFullYear()} ${process.env.COMPANY_NAME}. All rights reserved.</p>
          </div>

        </div>
      `
    };

    await sendEmailViaAPI(mailOptions);

  } catch (error) {
    console.error("Appointment email error:", error.message);
    throw new Error("Failed to send appointment confirmation email");
  }
};

const sendAppointmentStatusEmail = async (email, appointment, type) => {
  try {
    const date = new Date(appointment.dateOfAppointment).toLocaleDateString("en-IN");

    const templates = {
      cancelled: {
        title: "Appointment Cancelled",
        message: "Your appointment has been cancelled successfully.",
        color: "#dc2626"
      },
      rescheduled: {
        title: "Appointment Rescheduled",
        message: "Your appointment has been rescheduled.",
        color: "#f59e0b"
      },
      completed: {
        title: "Appointment Completed",
        message: "Your appointment has been successfully completed.",
        color: "#16a34a"
      }
    };

    const selected = templates[type];

    const mailOptions = {
      from: `"${process.env.COMPANY_NAME}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `${selected.title} - ${process.env.COMPANY_NAME}`,
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: auto; padding: 20px;">
          
          <div style="text-align: center;">
            <img src="${process.env.COMPANY_LOGO}" style="width: 70px;" />
            <h2 style="color: ${selected.color};">${selected.title}</h2>
          </div>

          <p>Hi <strong>${appointment.name}</strong>,</p>

          <p>${selected.message}</p>

          <div style="background:#f3f4f6; padding:15px; border-radius:6px;">
            <p><strong>Appointment ID:</strong> #${appointment._id.toString().slice(-6)}</p>
            <p><strong>Service:</strong> ${appointment.service}</p>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Time:</strong> ${appointment.time}</p>
            <p><strong>Location:</strong> ${appointment.location}</p>
          </div>

          ${
            type === "rescheduled"
              ? `<p style="margin-top:10px;"><strong>Reason:</strong> ${appointment.rescheduleReason || "N/A"}</p>`
              : ""
          }

          ${
            type === "cancelled"
              ? `<p style="color:#dc2626; margin-top:10px;">We’re sorry to see your appointment cancelled.</p>`
              : ""
          }

          ${
            type === "completed"
              ? `<p style="color:#16a34a; margin-top:10px;">Thank you for visiting us ❤️</p>`
              : ""
          }

          <p style="margin-top:20px;">Regards,<br/>${process.env.COMPANY_NAME}</p>

        </div>
      `
    };

    await sendEmailViaAPI(mailOptions);

  } catch (err) {
    console.error("Appointment status email failed:", err.message);
  }
};
module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusEmail,
  sendAppointmentConfirmationEmail,
  sendAppointmentStatusEmail
  
};