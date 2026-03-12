const escpos = require("escpos");
escpos.USB = require("escpos-usb");

function findUSBPrinter() {
  try {
    const devices = escpos.USB.findPrinter();
    if (!devices || devices.length === 0) return null;

    const dev = devices[0];
    return new escpos.USB(dev.vendorId, dev.productId);
  } catch (err) {
    return null;
  }
}

function printUSB(html) {
  return new Promise((resolve, reject) => {

    const device = findUSBPrinter();

    if (!device) {
      return reject("NO_USB_PRINTER");
    }

    const printer = new escpos.Printer(device);

    device.open((err) => {

      if (err) return reject(err);

      try {

        printer
          .raw(Buffer.from(html))
          .cut()
          .close();

        resolve(true);

      } catch (e) {
        reject(e);
      }

    });

  });
}

module.exports = { printUSB };