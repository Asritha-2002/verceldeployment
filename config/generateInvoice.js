const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const cloudinary = require('./cloudinary')

const generateInvoice = async (order) => {
  try {
    const invoiceNumber = order.orderDetails.invoice.number;

    const filePath = path.join(
      __dirname,
      `../invoices/${invoiceNumber}.pdf`
    );

    // 1. HTML TEMPLATE
    const html = `
      <html>
      <head>
        <style>
          body { font-family: Arial; padding: 20px; }
          .header { text-align: center; }
          .box { border: 1px solid #ddd; padding: 15px; margin-top: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border-bottom: 1px solid #eee; padding: 10px; text-align: left; }
        </style>
      </head>

      <body>

        <div class="header">
          <h2>${process.env.COMPANY_NAME}</h2>
          <h3>INVOICE</h3>
          <p>Invoice No: ${invoiceNumber}</p>
          <p>Date: ${new Date(order.createdAt).toLocaleString()}</p>
        </div>

        <div class="box">
          <h4>Customer</h4>
          <p>${order.shipping.address.street}</p>
          <p>${order.shipping.address.city}, ${order.shipping.address.state}</p>
          <p>${order.shipping.address.contactNumber}</p>
        </div>

        <div class="box">
          <h4>Items</h4>
          <table>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Price</th>
            </tr>

            ${order.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price}</td>
              </tr>
            `).join("")}

          </table>
        </div>

        <div class="box">
          <h3>Total: ₹${order.charges.totalAmount}</h3>
        </div>

      </body>
      </html>
    `;

    // 2. LAUNCH BROWSER
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: "networkidle0",
    });

    // 3. CREATE PDF LOCALLY
    await page.pdf({
      path: filePath,
      format: "A4",
    });

    await browser.close();

    // 4. UPLOAD TO CLOUDINARY
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      resource_type: "raw", // important for PDF
      folder: "invoices",
      public_id: invoiceNumber,
    });

    // 5. DELETE LOCAL FILE (clean server)
    fs.unlinkSync(filePath);

    // 6. RETURN CLOUDINARY URL
    return uploadResult.secure_url;

  } catch (err) {
    console.error("Invoice generation error:", err);
    throw err;
  }
};

module.exports = generateInvoice;