# 🚚 Shipping Guru Workshop

----
Welcome to the **ShippingGuru Challenge**!  
In this hands-on workshop, you’ll take on the role of a **Shipping Specialist** helping our (fictional) company **ShippingGuru** debug and optimize their sellers’ fulfillment flows.  

You’ll solve **real-world shipping and order management scenarios** using SP-API, Jupyter Notebooks, and the official SP-API SDK.

---

#### ⚠️ Check the [🚀 How to Access](#-how-to-access) to learn more about deployment.

---
## 🧩 The Challenge

You’ll work through a single Buy Shipping scenario:

**00-buy-shipping-challenge.ipynb**

- Problem: A seller is having issues purchasing and validating shipping labels through SP-API. 
- Your task: Debug the order and shipment flow using the Orders and Shipping APIs. 
- Clues: check order ID validity, item identifiers, addresses, rate IDs, and label format. 
- Deliverable: identify the errors in the workflow and successfully purchase a valid shipping label.

## 🛠️ Tools You’ll Use

- SP-API SDK → pre-installed in the environment (Python). 
- Sample Payloads → included in the notebook. 
- Mock Endpoints → provided for safe submission. If you have your own Mock Endpoints developed feel free to use them in the variables listed instead. 
- Clues & Hints → embedded in the notebook to guide you.

## 🚀 How to Access

### Quick Start - Amazon SP-API Mock Server

The fastest way to get started is using our automated setup scripts:

**macOS/Linux:**
```bash
cd selling-partner-api-samples/labs/server
sh setup.sh
```

**Windows:**

```bash
setup.bat
```

**The script will automatically:**

- Set up a virtual environment 
- Install all dependencies 
- Start the server at http://localhost:8000

You can run these notebooks on Amazon SageMaker → Notebook Instances
**OR** run them locally in any Jupyter environment:

```bash
cd labs/workshops/shipping-guru/buy-shipping-challenge
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
jupyter lab
```
