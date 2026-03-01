const generateReceiptHTML = (products, totalAmount, customerName) => {

  const date = new Date();

  const totalQty = products.reduce((s, p) => s + p.quantity, 0);
  const totalItems = products.length;

  const totalRupees = Math.floor(totalAmount);
  const totalPaise = Math.round((totalAmount - totalRupees) * 100);

  const numberToWords = (num) => {
    const a = [
      "", "One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
      "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen",
      "Sixteen","Seventeen","Eighteen","Nineteen"
    ];
    const b = ["", "", "Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

    if (num === 0) return "Zero";
    if (num < 20) return a[num];
    if (num < 100) return b[Math.floor(num / 10)] + " " + a[num % 10];
    if (num < 1000) return a[Math.floor(num / 100)] + " Hundred " + numberToWords(num % 100);
    if (num < 100000) return numberToWords(Math.floor(num / 1000)) + " Thousand " + numberToWords(num % 1000);
    return num;
  };

  let amountInWords = `Rupees ${numberToWords(totalRupees)}`;
  if (totalPaise > 0) amountInWords += ` and ${numberToWords(totalPaise)} Paise`;
  amountInWords += " Only";

  const productRows = products.map(p => `
    <tr>
      <td class="name">${p.name}</td>
      <td class="qty">${p.quantity}</td>
      <td class="rate">${p.price.toFixed(2)}</td>
      <td class="amt">${(p.price * p.quantity).toFixed(2)}</td>
    </tr>
  `).join("");

  return `
<html>
<head>
<style>

body{
  font-family: Courier, monospace;
  width: 280px;
  margin:0;
  padding:8px;
  font-size:12px;
}

.center{text-align:center}
.right{text-align:right}
.bold{font-weight:bold}

.line{
  border-top:1px dashed black;
  margin:6px 0;
}

table{
  width:100%;
  border-collapse:collapse;
}

td{
  padding:2px 0;
  vertical-align:top;
}

.name{width:45%}
.qty{width:15%; text-align:right}
.rate{width:20%; text-align:right}
.amt{width:20%; text-align:right}

.big{
  font-size:14px;
  font-weight:bold;
  text-align:center;
}

.small{
  font-size:10px;
}

</style>
</head>

<body>

<div class="center bold">HUNNY BUNNY</div>
<div class="center">CAKES & SWEETS</div>

<div class="center">TIRUCHENGODE ROAD CORNER</div>
<div class="center">NAMAKKAL - 637001</div>
<div class="center">Ph: 9443385035, 9585541355</div>

<div class="line"></div>

<div>Name: ${customerName}</div>
<div>Date: ${date.toLocaleDateString()}</div>
<div>Time: ${date.toLocaleTimeString()}</div>

<div class="line"></div>

<table>
<tr class="bold">
  <td class="name">Particulars</td>
  <td class="qty">Qty</td>
  <td class="rate">Rate</td>
  <td class="amt">Amount</td>
</tr>
</table>

<div class="line"></div>

<table>
${productRows}
</table>

<div class="line"></div>

<div>Qty : ${totalQty}</div>
<div>Items : ${totalItems}</div>
<div class="right bold">Total Amt : ${totalAmount.toFixed(2)}</div>

<div>Round off : 0.00</div>

<div class="line"></div>

<div class="center bold">N E T   A M O U N T</div>
<div class="big">INR ${totalAmount.toFixed(2)}</div>

<div class="center small">(${amountInWords})</div>

<div class="line"></div>

<div class="center small">UNIT OF SRI SAKTHI BAKERY, SWEETS & SNACKS</div>
<div class="center bold">!! Thanks !!! Visit Again !!</div>
<div class="center">For Order & Enquiry</div>
<div class="center">Call us on 9443385035</div>

</body>
</html>
`;
};

export default generateReceiptHTML;