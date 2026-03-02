import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "antd";
import { SyncOutlined } from "@ant-design/icons";
import ProductTable from "./ProductTable";
import CustomerForm from "./CustomerForm";
import PDFPreviewModal from "./PDFPreviewModal";
import generatePDF from "../../components/utils/pdfGenerator";
import axios from "axios";
import apiHost from "../../components/utils/api";
import "./QRScanner.css";
import {
  showSuccess,
  showError,
  showWarning,
} from "../../components/toast/toast";
import requestApi from "../../components/utils/axios";
import { jwtDecode } from "jwt-decode";
import generateReceiptHTML from "../../components/utils/receiptHtml";

const QRScanner = () => {
  const scannedCodes = useRef(new Set());
  const [products, setProducts] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [userLocation, setUserLocation] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [externalScannerBuffer, setExternalScannerBuffer] = useState("");
  const [isExternalScannerActive, setIsExternalScannerActive] = useState(false);
  const bufferTimeoutRef = useRef(null);

  /* ------------------------------------------------ */
  /* LOAD USER LOCATION */
  /* ------------------------------------------------ */

  useEffect(() => {
    const token = localStorage.getItem("D!");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserLocation(decoded?.location || "");
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    }
  }, []);

  const handleBufferInput = useCallback((value) => {
    setExternalScannerBuffer(value);
    setIsExternalScannerActive(true);
    if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
    bufferTimeoutRef.current = setTimeout(() => {
      setExternalScannerBuffer("");
      setIsExternalScannerActive(false);
    }, 500);
  }, []);

  const clearExternalScannerBuffer = useCallback(() => {
    setExternalScannerBuffer("");
    setIsExternalScannerActive(false);
    if (bufferTimeoutRef.current) clearTimeout(bufferTimeoutRef.current);
  }, []);

  const handleDirectPrint = async (products, total, customer) => {
    const html = generateReceiptHTML(products, total, customer);
    console.log("PRINT BUTTON CLICKED");
    await window.electronAPI.printHTML(html);
  };

  const handleSaveAndDirectPrint = async () => {
    const finalCustomerName = customerName.trim() ? customerName : "--";
    if (products.length === 0) return showWarning("Scan Atleast 1 product");

    const printProducts = [...products];
    const printTotal = totalAmount;
    const printCustomer = finalCustomerName;

    setIsGenerating(true);
    try {
      await requestApi(
        "POST",
        `/bills/bill-details`,
        buildPayload(finalCustomerName),
      );

      showSuccess("Bill saved successfully!");

      handleDirectPrint(printProducts, printTotal, printCustomer);

      handleClearAll();
    } catch (err) {
      showError("Failed to save bill.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "F5") {
        e.preventDefault();
        handleSaveBillOnly();
      } else if (e.key === "F6") {
        e.preventDefault();
        handleSaveAndDirectPrint();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [products, customerName, paymentMethod, totalAmount, userLocation]);

  const fetchProduct = async (code) => {
    try {
      const res = await axios.get(
        `${apiHost}/products/qr_products?term=${code}`,
      );
      const prod = res.data.data?.[0];
      if (!prod) throw new Error("Product not found");

      const price = parseFloat(prod.price);
      const newProduct = { ...prod, price, quantity: 1 };

      setProducts((prev) => {
        const exists = prev.some((p) => p.code === newProduct.code);
        if (exists) return prev;
        return [...prev, newProduct];
      });
    } catch {
      showError("Product not found or error.");
    }
  };

  const recalculateTotal = (updated) => {
    const total = updated.reduce((sum, p) => sum + p.price * p.quantity, 0);
    setTotalAmount(total);
  };

  const handleChange = (index, field, value) => {
    setProducts((prev) => {
      let updated = [...prev];
      if (field === "delete") {
        updated.splice(index, 1);
      } else {
        if (!updated[index]) {
          updated[index] = { code: "", name: "", price: 0, quantity: 1 };
        }
        if (["price", "quantity"].includes(field)) {
          updated[index][field] = parseFloat(value) || 0;
        } else {
          updated[index][field] = value;
        }
      }
      setTimeout(() => recalculateTotal(updated), 0);
      return updated;
    });
  };

  useEffect(() => {
    recalculateTotal(products);
  }, [products]);

  const handleClearAll = () => {
    scannedCodes.current.clear();
    setProducts([]);
    setTotalAmount(0);
    setCustomerName("");
    setPaymentMethod("UPI");

    setTimeout(() => {
      customerInputRef.current?.focus();
    }, 100);

  };

  const handleProductSelect = (product) => {
    const exists = products.some((p) => p.code === product.code);
    if (!exists) {
      const newProduct = {
        code: product.code,
        name: product.name,
        price: parseFloat(product.price),
        quantity: 1,
      };
      const updated = [...products, newProduct];
      setProducts(updated);
      recalculateTotal(updated);
    }
  };

  const buildPayload = (finalCustomerName) => ({
    customer_name: finalCustomerName,
    total_amount: totalAmount,
    payment_method: paymentMethod,
    location: userLocation,
    items: products
      .filter((p) => p.code && p.name)
      .map((p) => ({
        product_name: p.name,
        quantity: p.quantity,
        unit_price: p.price,
      })),
  });

  const handleSaveBillOnly = async () => {
    const finalCustomerName = customerName.trim() ? customerName : "--";
    if (products.length === 0) return showWarning("Scan Atleast 1 Product");

    setIsSaving(true);
    try {
      await requestApi(
        "POST",
        `/bills/bill-details`,
        buildPayload(finalCustomerName),
      );
      showSuccess("Bill saved successfully");
      handleClearAll();
    } catch {
      showError("Failed to save bill.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBill = async () => {
    const finalCustomerName = customerName.trim() ? customerName : "--";
    if (products.length === 0) return showWarning("Scan Atleast 1 products");

    setIsGenerating(true);
    try {
      await requestApi(
        "POST",
        `/bills/bill-details`,
        buildPayload(finalCustomerName),
      );
      showSuccess("Bill saved successfully!");
      handlePreviewBill();
    } catch {
      showError("Failed to save bill.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreviewBill = () => {
    const doc = generatePDF(products, totalAmount, customerName);
    const dataUri = doc.output("datauristring");
    setPdfUrl(dataUri);
    setShowPreview(true);
    handleClearAll();
  };

  useEffect(() => {
    let inputBuffer = "";

    const handleKeyPress = (e) => {
      if (e.key === "Enter") {
        const code = inputBuffer.trim();
        inputBuffer = "";
        clearExternalScannerBuffer();
        if (code && !scannedCodes.current.has(code)) {
          scannedCodes.current.add(code);
          fetchProduct(code);
          showSuccess(`Scanned: ${code}`);
        }
      } else if (e.key.length === 1) {
        inputBuffer += e.key;
        setExternalScannerBuffer(inputBuffer);
        setIsExternalScannerActive(true);
        setTimeout(() => {
          setIsExternalScannerActive(false);
          setExternalScannerBuffer("");
        }, 3000);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        inputBuffer = "";
        setExternalScannerBuffer("");
        setIsExternalScannerActive(false);
        showWarning("Scanner buffer cleared.");
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keypress", handleKeyPress);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="qr-container">
      <div className="qr-reader-table">
        <CustomerForm
          customerName={customerName}
          setCustomerName={setCustomerName}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          handleBufferInput={handleBufferInput}
        />

        <ProductTable
          products={products}
          handleChange={handleChange}
          totalAmount={totalAmount}
          handleClearAll={handleClearAll}
          handleSaveBill={handleSaveBill}
          handleProductSelect={handleProductSelect}
          isExternalScannerActive={isExternalScannerActive}
          externalScannerBuffer={externalScannerBuffer}
          clearExternalScannerBuffer={clearExternalScannerBuffer}
          handleBufferInput={handleBufferInput}
        />

        <div className="flex justify-end gap-2 bill-container">
          <Button danger type="primary" onClick={handleClearAll}>
            Clear All
          </Button>

          <Button onClick={handleSaveBillOnly} loading={isSaving}>
            Save
          </Button>

          <Button
            type="primary"
            onClick={handleSaveBill}
            loading={isGenerating}
          >
            Save & Generate Bill
          </Button>
        </div>
      </div>

      {showPreview && (
        <PDFPreviewModal
          pdfUrl={pdfUrl}
          onClose={() => setShowPreview(false)}
          onDownload={() => {
            const doc = generatePDF(products, totalAmount, customerName);
            doc.save("Product_Bill.pdf");
            setShowPreview(false);
          }}
        />
      )}
    </div>
  );
};

export default QRScanner;
