import jsPDF from "jspdf";
import { toWords } from "number-to-words";

const generatePDF = (products, totalAmount, customerName, payment) => {
  // 1. CONFIGURATION
  // We increase width to 200 (approx 70mm) to give more horizontal space
  // If your printer cuts off text, reduce this back to 190 or 180
  const pageWidth = 200;
  const startX = 5; // Reduced margin to 5 to maximize space
  const centerX = pageWidth / 2;
  const endX = pageWidth - 5;

  // Column positions (adjusted for wider 200pt page)
  const nameColWidth = 75; // Gave more space to product name
  const qtyColX = startX + 95;
  const rateColX = startX + 135;
  const amountColX = endX; // Right align to the very edge

  // 2. CALCULATE EXACT HEIGHT
  // We need a dummy doc just to calculate how many lines the product names will take
  const dummyDoc = new jsPDF({ unit: "pt", format: [pageWidth, 1000] });
  dummyDoc.setFont("Courier", "normal");
  dummyDoc.setFontSize(9);

  let productHeight = 0;
  products.forEach((p) => {
    // Calculate how many lines this product name will wrap into
    const lines = dummyDoc.splitTextToSize(p.name, nameColWidth);
    productHeight += lines.length * 10; // 10 is the line height used in loop
  });

  // Calculate static height (Header + Footer parts)
  // Based on the Y increments in the logic below:
  // Header: 18+10+13+10+10+10+10+10+10+10 = 111 + 9 (gap) = 120
  // Footer: 4+10+10+10+10+10+10+10+10+12+10+10+10 = 126
  // Total Static: ~246 pts. We add a small buffer (+5) to be safe.
  const headerHeight = 120;
  const footerHeight = 135;
  const totalPageHeight = headerHeight + productHeight + footerHeight + 130;

  // 3. GENERATE ACTUAL PDF
  const doc = new jsPDF({
    unit: "pt",
    format: [pageWidth, totalPageHeight], // Set exact calculated height
  });

  let y = 18;

  // --- HEADER ---
  doc.setFont("Courier", "bold");
  doc.setFontSize(11);
  doc.text("HUNNY BUNNY", centerX, y, { align: "center" });

  doc.setFontSize(9);
  y += 10;
  doc.text("CAKES & SWEETS", centerX, y, { align: "center" });

  y += 13;

  doc.setFontSize(8);
  doc.text("TIRUCHENGODE ROAD CORNER", centerX, y, { align: "center" });
  y += 10;
  doc.text("NAMAKKAL - 637001", centerX, y, { align: "center" });
  y += 10;
  doc.text("Ph: 9443385035, 9585541355", centerX, y, { align: "center" });
  y += 10;
  doc.text("-----------------------------------------------", centerX, y, {
    align: "center",
  });
  y += 10;
  doc.text(`Name: ${customerName}`, startX, y);
  y += 10;

  const date = new Date();
  doc.text(`Date: ${date.toLocaleDateString()}`, startX, y);
  doc.text(`Time: ${date.toLocaleTimeString()}`, endX, y, { align: "right" }); // Aligned to right edge
  y += 10;
  doc.text("-----------------------------------------------", centerX, y, {
    align: "center",
  });
  y += 10;

  doc.setFont("Courier", "bold");
  doc.text("Particulars", startX, y);
  doc.text("Qty", qtyColX, y, { align: "right" });
  doc.text("Rate", rateColX, y, { align: "right" });
  doc.text("Amount", amountColX, y, { align: "right" });
  y += 9;
  doc.setFont("Courier", "normal");

  // --- PRODUCT LIST ---
  products.forEach((p) => {
    // Wrap the product name using the real doc this time
    const nameLines = doc.splitTextToSize(p.name, nameColWidth);

    const qty = p.quantity.toString();
    const rate = p.price.toFixed(2);
    const amount = (p.price * p.quantity).toFixed(2);

    nameLines.forEach((line, idx) => {
      doc.text(line, startX, y);
      if (idx === 0) {
        // Only print numbers on the first line of the product
        doc.text(qty, qtyColX, y, { align: "right" });
        doc.text(rate, rateColX, y, { align: "right" });
        doc.text(amount, amountColX, y, { align: "right" });
      }
      y += 10;
    });
  });

  // --- FOOTER ---
  y += 4;
  doc.text(`Qty : ${products.reduce((s, p) => s + p.quantity, 0)}`, startX, y);
  y += 10;

  doc.text(`Items : ${products.length}`, startX, y);

  // Moved Total Amount explicitly to align better
  doc.text(`Total Amt : ${totalAmount.toFixed(2)}`, startX + 80, y);
  y += 10;

  doc.text("Round off : 0.00", startX, y);
  y += 10;
  doc.text("-----------------------------------------------", centerX, y, {
    align: "center",
  });
  y += 10;

  doc.text("N E T   A M O U N T", centerX, y, { align: "center" });
  y += 10;

  doc.setFont("Courier", "bold");
  doc.setFontSize(10); // Slightly larger for final amount
  doc.text(`INR ${totalAmount.toFixed(2)}`, centerX, y, { align: "center" });
  y += 10;

  const totalRupees = Math.floor(totalAmount);
  const totalPaise = Math.round((totalAmount - totalRupees) * 100);

  let amountInWords = `Rupees ${toWords(totalRupees)}`;
  if (totalPaise > 0) {
    amountInWords += ` and ${toWords(totalPaise)} Paise`;
  }
  amountInWords += " Only";

  doc.setFontSize(7);
  // Wrap words if they are too long
  const wordLines = doc.splitTextToSize(`(${amountInWords})`, pageWidth - 20);
  wordLines.forEach((line) => {
    doc.text(line, centerX, y, { align: "center" });
    y += 8; // Small increment for multi-line words
  });

  y += 2; // spacer

  doc.setFont("Courier", "normal");
  doc.text("-----------------------------------------------", centerX, y, {
    align: "center",
  });
  y += 12;

  doc.setFont("Courier", "normal");
  doc.setFontSize(6);
  doc.text("UNIT OF SRI SAKTHI BAKERY, SWEETS & SNACKS", centerX, y, {
    align: "center",
  });
  y += 10;

  doc.setFont("Courier", "bold");
  doc.text("!! Thanks !!! Visit Again !!", centerX, y, { align: "center" });
  y += 10;

  doc.setFont("Courier", "normal");
  doc.text("For Order & Enquiry", centerX, y, { align: "center" });
  y += 10;
  doc.text("Call us on 9443385035", centerX, y, { align: "center" });

  return doc;
};

export default generatePDF;