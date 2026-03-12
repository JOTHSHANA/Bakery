import React, { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "antd";
import ProductTable from "./ProductTable";
import CustomerForm from "./CustomerForm";
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
  const customerInputRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
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
  const productsRef = useRef(products);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

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

useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;
    const SCAN_SPEED = 50;

    const handleKeyDown = (e) => {
      /* SHORTCUTS */
      if (e.key === "F5") {
        e.preventDefault();

        // Safe to use productsRef here, but handleSaveBillOnly now has fresh state too!
        if (productsRef.current.length === 0) {
          showWarning("Scan Atleast 1 product");
          return;
        }

        handleSaveBillOnly();
        return;
      }

      if (e.key === "F6") {
        e.preventDefault();

        if (productsRef.current.length === 0) {
          showWarning("Scan Atleast 1 product");
          return;
        }

        handleSaveAndDirectPrint();
        return;
      }

      /* SCANNER LOGIC */
      const active = document.activeElement;

      if (
        active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable
      ) {
        return;
      }

      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      if (timeDiff > SCAN_SPEED) {
        buffer = "";
      }

      if (e.key === "Enter") {
        const code = buffer.trim();
        buffer = "";

        if (!code || code.length < 4) return;

        if (!scannedCodes.current.has(code)) {
          scannedCodes.current.add(code);
          fetchProduct(code);
          showSuccess(`Scanned: ${code}`);
        }

        return;
      }

      if (e.key.length !== 1) return;

      buffer += e.key;

      setExternalScannerBuffer(buffer);
      setIsExternalScannerActive(true);

      clearTimeout(bufferTimeoutRef.current);

      bufferTimeoutRef.current = setTimeout(() => {
        setExternalScannerBuffer("");
        setIsExternalScannerActive(false);
      }, 500);
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [handleSaveAndDirectPrint, handleSaveBillOnly]); // <-- Added dependencies here

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
          // handleSaveBill={handleSaveBill}
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
            onClick={handleSaveAndDirectPrint}
            loading={isGenerating}
          >
            Save & Generate Bill
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
