# 📊 Data Kiosk Flow Tutorial

---

Welcome to the **Data Kiosk Flow Tutorial**!  
In this hands-on tutorial, you’ll learn how to work with the **Amazon Data Kiosk API** and understand the **end-to-end flow of querying, retrieving, and analyzing seller economics data**.  

Unlike workshops, which are challenge-based, this tutorial is designed to **teach you the request/response flow** of the Data Kiosk API step by step.

---

#### ⚠️ Check the [🚀 How to Access](#-how-to-access) to learn more about deployment.

---

## 🧩 The Tutorial

This tutorial is organized into a single notebook:

#### data-kiosk-flow.ipynb

- **Goal**: Learn the flow of the Data Kiosk API from query creation to document retrieval.
- **Steps you’ll cover**:
  1. Create a Data Kiosk query with `POST /dataKiosk/2023-11-15/queries`
  2. Check query status with `GET /dataKiosk/2023-11-15/queries/{queryId}`
  3. Retrieve all queries with `GET /dataKiosk/2023-11-15/queries`
  4. Fetch the final dataset with `GET /dataKiosk/2023-11-15/documents/{documentId}`
- **Deliverable**: Understand how Data Kiosk integrates into SP-API flows and be able to extend queries for your own use cases.

---

## 🛠️ Tools You’ll Use

- SP-API SDK → pre-installed in the environment (Python).
- Sample Payloads → included in the notebook.
- Mock Endpoints → provided for safe experimentation (no live API calls required).
- Step-by-Step Guidance → built directly into the notebook to help you follow the flow.

---

## 🎯 What You’ll Learn

By completing this tutorial, you’ll:
- Understand the **full lifecycle** of a Data Kiosk query.
- Learn how to **test queries locally** with the mock server.
- Gain the foundation to integrate Data Kiosk into **custom seller analytics solutions**.

---

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
cd labs/tutorials/data-kiosk
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
jupyter lab
```
