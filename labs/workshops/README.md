# 🏋️ SP-API Workshops

Welcome to the **SP-API Workshops** folder!  
Here you’ll find hands-on challenges designed to simulate real-world seller problems and give you practical experience with the **Selling Partner API**.

Each workshop:
- Provides a **scenario** based on real seller issues.
- Walks you through **multiple SP-API workflows**.
- Includes **sample payloads, hints, and mock endpoints** for safe experimentation.
- Can be run in **AWS SageMaker (recommended)** or locally via Jupyter.

---

## 🚀 How to Get Started

### Quick Start - Amazon SP-API Mock Server

The fastest way to get started is using our automated setup scripts:

**macOS/Linux:**
```bash
cd sellig-partner-api-samples/labs/server
sh setup.sh
```

Or download and run:
```bash
curl -O https://raw.githubusercontent.com/amzn/sp-api-sample-solutions/main/labs/server/setup.sh
chmod +x setup.sh
./setup.sh
```

**Windows:**
```cmd
setup.bat
```

The script will automatically:
- Set up a virtual environment
- Install all dependencies
- Start the server at `http://localhost:8000`

---
1. **SageMaker (AWS Mode)**  
   - Open your AWS account.  
   - Go to **Amazon SageMaker → Notebook Instances**.  
   - Open Jupyter and upload the notebook for a cleaner visual.

2. **Local Jupyter (Local Mode)**  
   ```bash
   cd labs/workshops
   jupyter lab
   ```

## 📚 Available Challenges

| Challenge                                | Folder                                                                                                                                         | Focus APIs                     | Scenario                                                               |
|------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------|------------------------------------------------------------------------|
| 🧙 ListingsWizard                        | [`listings-wizard/`](https://github.com/amzn/selling-partner-api-samples/tree/hands-on-labs/labs/workshops/listings-wizard)                     | Listings, Pricing, Data Kiosk   | Optimize listings conversion, pricing, and refund rates                |
| 🚚 ShippingGuru - Buy Shipping Challenge | [`shipping-guru/buy-shipping-challenge/`](https://github.com/amzn/selling-partner-api-samples/tree/hands-on-labs/labs/workshops/shipping-guru/buy-shipping-challenge) | Orders, Shipping (Buy Shipping) | Debug and optimize a seller’s shipping workflow using SP-API Buy Shipping |
