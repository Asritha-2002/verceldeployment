const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const cloudinary = require("./cloudinary");

const generateInvoice = async (order) => {
  try {
    const invoiceNumber = order.orderDetails.invoice.number;
    const dirPath = path.join(__dirname, "../invoices");

    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filePath = path.join(dirPath, `${invoiceNumber}.pdf`);

    const subtotal = order.items.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    );

    const html = `
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 30px;
          color: #333;
        }

        .header {
          display: flex;
          justify-content: space-between;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }

        .title {
          font-size: 26px;
          font-weight: bold;
        }

        .section {
          margin-top: 20px;
          display: flex;
          justify-content: space-between;
        }

        .box {
          width: 48%;
          font-size: 13px;
          line-height: 1.5;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          font-size: 13px;
          text-align: left;
        }

        th {
          background: #f4f4f4;
        }

        .total {
          text-align: right;
          margin-top: 20px;
          font-size: 16px;
          font-weight: bold;
        }

        .footer {
          margin-top: 40px;
          font-size: 12px;
          border-top: 1px solid #ccc;
          padding-top: 10px;
        }
      </style>
    </head>

    <body>

      <div class="header">
        <div>
          <div class="title">INVOICE</div>
          <div>Invoice No: ${invoiceNumber}</div>
          <div>Date: ${new Date(order.createdAt).toLocaleString()}</div>
        </div>

        <div>
          <strong>Vetdiaggenomix</strong><br/>
          Vijayawada, Andhra Pradesh<br/>
          GSTIN: 29ABCDE1234F1Z5
        </div>
      </div>

      <div class="section">
        <div class="box">
          <strong>Bill To:</strong><br/>
          ${order.user.name}<br/>
          ${order.shipping.address.street}<br/>
          ${order.shipping.address.city}, ${order.shipping.address.state}<br/>
          ${order.shipping.address.contactNumber}
        </div>

        <div class="box">
          <strong>Ship To:</strong><br/>
          ${order.shipping.address.street}<br/>
          ${order.shipping.address.city}, ${order.shipping.address.state}
        </div>
      </div>

      <table>
        <tr>
          <th>Item</th>
          <th>Qty</th>
          <th>Price</th>
          <th>Total</th>
        </tr>

        ${order.items
          .map(
            (item) => `
          <tr>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>₹${Number(item.price).toFixed(2)}</td>
            <td>₹${(item.price * item.quantity).toFixed(2)}</td>
          </tr>
        `
          )
          .join("")}
      </table>

      <div class="total">
        Subtotal: ₹${subtotal.toFixed(2)} <br/>
        Grand Total: ₹${Number(order.charges.totalAmount).toFixed(2)}
      </div>

      <div class="footer">
        Thank you for your purchase. For support contact our team.
      </div>

    </body>
    </html>
    `;

    // 🚀 Puppeteer launch with INCREASED TIMEOUT SETTINGS
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();

    // ✅ INCREASED TIMEOUT (IMPORTANT)
    await page.setDefaultTimeout(120000); // 2 minutes
    await page.setDefaultNavigationTimeout(120000); // 2 minutes

    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: 120000,
    });

    await page.pdf({
      path: filePath,
      format: "A4",
      printBackground: true,
    });

    await browser.close();

    const uploadResult = await cloudinary.uploader.upload(filePath, {
      resource_type: "raw",
      folder: "invoices",
      public_id: invoiceNumber,
    });

    fs.unlinkSync(filePath);

    return uploadResult.secure_url;
  } catch (err) {
    console.error("Invoice error:", err);
    throw err;
  }
};

module.exports = generateInvoice;