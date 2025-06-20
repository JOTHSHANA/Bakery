// components/Products/ProductCard.jsx
import React from "react";
import {
    Card,
    DatePicker,
    Popconfirm,
    Button,
    Select,
} from "antd";
import {
    EditOutlined,
    DeleteOutlined,
    SaveOutlined,
    CloseOutlined,
} from "@ant-design/icons";
import PrintIcon from "@mui/icons-material/Print";
import apiHost from "../../components/utils/api";
import dayjs from "dayjs";

const ProductCard = ({
    product,
    quantity,
    state,
    handleEdit,
    handleSave,
    handleCancel,
    handleDelete,
    handleQtyChange,
    handleDateChange,
    openStickerModal
}) => {
    return (
        <Card
            className="custom-card"
            style={{ width: 400 }}
            actions={[
                state?.editing ? (
                    <Popconfirm title="Save changes?" onConfirm={() => handleSave(product.id)}>
                        <SaveOutlined style={{ color: "#635bff", fontSize: "20px" }} />
                    </Popconfirm>
                ) : (
                    <EditOutlined
                        style={{ color: "#4bf478", fontSize: "20px" }}
                        onClick={() => handleEdit(product)}
                    />

                ),
                state?.editing ? (
                    <Popconfirm title="Discard changes?" onConfirm={() => handleCancel(product.id)}>
                        <CloseOutlined style={{ color: "red", fontSize: "20px" }} />
                    </Popconfirm>
                ) : (
                    <Popconfirm title="Delete dates?" onConfirm={() => handleDelete(product.id)}>
                        <DeleteOutlined style={{ color: "#b20900", fontSize: "20px" }} />
                    </Popconfirm>
                ),
            ]}
        >
            <Button
                icon={<PrintIcon style={{ color: "#616773" }} />}
                type="text"
                shape="circle"
                style={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}
                onClick={() => openStickerModal(product)}
            />

            <div className="flex gap-30">
                <div className="flex flex-1 flex-col items-center justify-center">
                    <img
                        src={`${apiHost}/public/${product.qr_code}`}
                        alt="QR code"
                        className="w-24 h-24 object-contain bg-white p-1"
                    />
                    <p className="text-sm font-semibold mt-2">{product.code}</p>
                </div>
                <div className="flex flex-1 flex-col justify-between w-full">
                    <p className="text-lg font-bold"><b>{product.name}</b></p>
                    <p>₹ {product.price}</p>
                    {state?.editing ? (
                        <>
                            <Select
                                showSearch
                                placeholder="Select a quantity"
                                value={state?.qty || null}
                                onChange={(value) => handleQtyChange(product.id, value)}
                                filterOption={(input, option) =>
                                    option.label.toLowerCase().includes(input.toLowerCase())
                                }
                                options={quantity}
                                style={{ width: 200 }}
                            />
                            <DatePicker
                                placeholder="Packed Date"
                                onChange={(d, ds) => handleDateChange(product.id, "pkd", d, ds)}
                                format="DD-MM-YYYY"
                                style={{ width: "100%" }}
                            />
                            <DatePicker
                                placeholder="Expiry Date"
                                onChange={(d, ds) => handleDateChange(product.id, "exp", d, ds)}
                                format="DD-MM-YYYY"
                                style={{ width: "100%" }}
                                minDate={state.pkd ? dayjs(state.pkd, "DD-MM-YYYY") : null}
                            />
                            <p><b>Qty:</b> {product.product_quantity} {state.qty || "--"}</p>
                        </>
                    ) : (
                        <>
                            <p><b>Qty:</b> {product.product_quantity} {state.qty || "--"}</p>
                            <p><b>pkd:</b> {state.pkd || "--"}</p>
                            <p><b>exp:</b> {state.exp || "--"}</p>
                        </>
                    )}
                </div>
            </div>
        </Card>
    );
};

export default ProductCard;
