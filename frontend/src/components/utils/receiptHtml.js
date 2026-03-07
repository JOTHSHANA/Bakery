const generateReceiptHTML = (products, totalAmount, customerName) => {

  const date = new Date();

  const totalQty = products.reduce((s, p) => s + p.quantity, 0);
  const totalItems = products.length;

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

  const amountInWords = `Rupees ${numberToWords(Math.floor(totalAmount))} Only`;

  // split long names
  const splitName = (name) => {
    const max = 18;
    if (name.length <= max) return [name];

    const words = name.split(" ");
    let lines = [];
    let current = "";

    words.forEach(w => {
      if ((current + w).length < max) {
        current += w + " ";
      } else {
        lines.push(current.trim());
        current = w + " ";
      }
    });

    if (current) lines.push(current.trim());
    return lines;
  };

  const productRows = products.map(p => {

    const lines = splitName(p.name);

    const firstRow = `
<tr>
<td class="name">${lines[0]}</td>
<td class="qty">${String(p.quantity).padStart(3," ")}</td>
<td class="rate">${p.price.toFixed(2)}</td>
<td class="amt">${(p.price * p.quantity).toFixed(2)}</td>
</tr>`;

    const extraRows = lines.slice(1).map(l => `
<tr>
<td class="name">${l}</td>
<td></td>
<td></td>
<td></td>
</tr>`).join("");

    return firstRow + extraRows;

  }).join("");

  return `
<html>
<head>
<style>

body{
  font-family:"Courier New", monospace;
  width:260px;
  margin:0;
  padding:6px;
  font-size:12px;
}

.center{text-align:center;}
.right{text-align:right;}
.bold{font-weight:bold;}

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
}

/* item column slightly bigger */
.name{
 width:50%;
 font-size:12px;
}

/* numeric columns smaller like POS */
.qty{
 width:10%;
 text-align:right;
 font-size:11px;
}

.rate{
 width:20%;
 text-align:right;
 font-size:11px;
}

.amt{
 width:20%;
 text-align:right;
 font-size:11px;
}

</style>
</head>

<body>

<div class="center bold">HUNNY BUNNY</div>
<div class="center">CAKES & SWEETS</div>
<div class="center">TIRUCHENGODE ROAD CORNER</div>
<div class="center">NAMAKKAL - 637001</div>
<div class="center">Ph: 9443385035</div>

<div class="line"></div>

<div>Name : ${customerName}</div>
<div>Date : ${date.toLocaleDateString()}</div>
<div>Time : ${date.toLocaleTimeString()}</div>

<div class="line"></div>

<table>
<tr class="bold">
<td class="name">Item</td>
<td class="qty">Q</td>
<td class="rate">Rate</td>
<td class="amt">Amt</td>
</tr>
</table>

<div class="line"></div>

<table>
${productRows}
</table>

<div class="line"></div>

<div>Qty : ${totalQty}</div>
<div>Items : ${totalItems}</div>

<div class="right bold">Total : ${totalAmount.toFixed(2)}</div>

<div class="line"></div>

<div class="center bold">NET AMOUNT</div>
<div class="center bold">INR ${totalAmount.toFixed(2)}</div>

<div class="center">(${amountInWords})</div>

<div class="line"></div>

<div class="center">UNIT OF SRI SAKTHI BAKERY</div>
<div class="center bold">!! Thanks Visit Again !!</div>
<div class="center">9443385035</div>

</body>
</html>
`;
};

export default generateReceiptHTML;