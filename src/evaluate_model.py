import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import confusion_matrix, classification_report
import matplotlib.pyplot as plt
import seaborn as sns
import re
import os
import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = Path(__file__).resolve().parent

# ==========================================
# 1. ĐỌC MÔ HÌNH TỪ FILE .h (C-Array)
# ==========================================
header_file_path = BASE_DIR / "dht_anomaly_model.h"

def load_tflite_from_header(file_path):
    print(f"Đang đọc mô hình từ {file_path}...")
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Không tìm thấy file: {file_path}")
        
    with open(file_path, "r") as f:
        content = f.read()

    # Dùng Regex để trích xuất nội dung nằm giữa cặp ngoặc nhọn {}
    match = re.search(r'\{([^}]+)\}', content)
    if not match:
        raise ValueError("Không tìm thấy mảng byte trong file .h")

    # Tách các chuỗi "0xXX", dọn dẹp khoảng trắng và chuyển thành byte
    hex_data = match.group(1)
    hex_values = [x.strip() for x in hex_data.split(',') if x.strip()]
    
    # Chuyển đổi danh sách hex thành mảng byte nhị phân (bytes)
    model_bytes = bytes([int(x, 16) for x in hex_values])
    return model_bytes

# Tải mảng byte và đưa trực tiếp vào Interpreter qua tham số model_content
model_bytes = load_tflite_from_header(header_file_path)
interpreter = tf.lite.Interpreter(model_content=model_bytes)
interpreter.allocate_tensors()

input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

print("Đã tải và cấp phát Tensor Arena cho mô hình thành công!")

# ==========================================
# 2. ĐỌC DỮ LIỆU KIỂM THỬ
# ==========================================
# Cấu trúc file test_data.csv: temperature,humidity,label
df = pd.read_csv(BASE_DIR / "test_data.csv")

y_true = df['label'].values
y_pred = []
test_results = []

print(f"Bắt đầu chạy suy luận (inference) cho {len(df)} mẫu dữ liệu...")

# ==========================================
# 3. CHẠY INFERENCE QUA TỪNG DÒNG DỮ LIỆU
# ==========================================
for index, row in df.iterrows():
    # Mô hình của bạn yêu cầu input là float32 và shape (1, 2)
    input_data = np.array([[row['temperature'], row['humidity']]], dtype=np.float32)
    
    # Đẩy dữ liệu vào Tensor Arena
    interpreter.set_tensor(input_details[0]['index'], input_data)
    
    # Thực hiện suy luận
    interpreter.invoke()
    
    # Lấy kết quả đầu ra
    output_data = interpreter.get_tensor(output_details[0]['index'])
    result = output_data[0][0]
    
    # Áp dụng ngưỡng 0.5: > 0.5 là Bất thường (1), ngược lại là Bình thường (0)
    prediction = 1 if result > 0.5 else 0
    y_pred.append(prediction)
    test_results.append({
        "index": index + 1,
        "temperature": row["temperature"],
        "humidity": row["humidity"],
        "expected": row["label"],
        "score": result,
        "prediction": prediction,
        "passed": prediction == row["label"],
    })

# ==========================================
# 4. TÍNH TOÁN VÀ IN BÁO CÁO ĐÁNH GIÁ
# ==========================================
print("\n--- BÁO CÁO PHÂN LOẠI (CLASSIFICATION REPORT) ---")
print("\n--- KẾT QUẢ TỪNG TESTCASE ---")
print(f"{'No.':>3} {'Temp':>8} {'Humidity':>10} {'Expected':>10} {'Score':>10} {'Predicted':>10} {'Result':>8}")
print("-" * 68)
for item in test_results:
    status = "PASS" if item["passed"] else "FAIL"
    print(
        f"{item['index']:>3} "
        f"{item['temperature']:>8.1f} "
        f"{item['humidity']:>10.1f} "
        f"{int(item['expected']):>10} "
        f"{item['score']:>10.6f} "
        f"{item['prediction']:>10} "
        f"{status:>8}"
    )

print(classification_report(y_true, y_pred, target_names=["Normal (0)", "Anomaly (1)"], zero_division=0))

# ==========================================
# 5. VẼ MA TRẬN NHẦM LẪN (CONFUSION MATRIX)
# ==========================================
cm = confusion_matrix(y_true, y_pred)

plt.figure(figsize=(6, 4))
sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", cbar=False,
            xticklabels=["Normal (0)", "Anomaly (1)"],
            yticklabels=["Normal (0)", "Anomaly (1)"])

plt.title("Confusion Matrix")
plt.xlabel("Dự đoán của TFLite")
plt.ylabel("Thực tế (Ground Truth)")
plt.tight_layout()

# Lưu ảnh và hiển thị
output_path = BASE_DIR / "confusion_matrix.png"
plt.savefig(output_path)
print("Đã lưu biểu đồ ma trận nhầm lẫn thành file 'confusion_matrix.png'.")
plt.close()
