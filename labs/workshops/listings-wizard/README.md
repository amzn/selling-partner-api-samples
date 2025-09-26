# 🧙‍♂️ ListingsWizard SP-API Workshop

Welcome to the **ListingsWizard Challenge**!  
In this hands-on workshop, you’ll take on the role of an **Amazon Listings Expert** helping our (fictional) company **ListingsWizard** optimize their sellers’ performance.  

You’ll solve **real-world listing optimization scenarios** using SP-API, Jupyter Notebooks, and the official SP-API SDK.

---

## 🚀 How to Access

We’ve prepared AWS test accounts with SageMaker for you:
1. Open the launch URL shared in the presentation.
2. Log in with the provided credentials.
3. Navigate to **Amazon SageMaker → Notebook Instances**.
4. Open Jupyter and launch the `workshops/listings-wizard/` folder.


Alternatively, you can download these notebooks and run them locally in any Jupyter environment:
```bash
git clone https://github.com/amzn/sp-api-sample-solutions.git
cd labs/workshops/listings-wizard
pip install -r ../../env/requirements.txt
jupyter lab
```
---

## 🧩 The Challenges

You’ll tackle three Listings scenarios, each in its own notebook:

#### 00-low-conversion-challenge.ipynb

- **Problem**: One of ListingsWizard’s products is not converting well.
- **Your task**: Diagnose the issue using Listings API + Data Kiosk data, and suggest optimizations.
- **Clues**: look at product detail quality and discoverability.
- **Deliverable**: identify the root cause and propose fixes.

#### 01-pricing-performance-challenge.ipynb

- **Problem**: Sales are flat compared to competitors despite steady traffic.
- **Your task**: Use the Pricing API + Data Kiosk to benchmark against competitors and adjust pricing strategy.
- **Clues**: check buy box price dynamics.
- **Deliverable**: suggest an optimal pricing adjustment.

#### 02-high-refund-challenge.ipynb

- **Problem**: A best-selling product suddenly has a spike in refunds.
- **Your task**: Analyze return reasons with Listings + Reports APIs and recommend corrective actions.
- **Clues**: check item quality, description accuracy, and customer feedback.
- **Deliverable**: identify the main cause and propose how to reduce refunds.

---

## 🛠️ Tools You’ll Use

- SP-API SDK → pre-installed in the environment (Python).
- Sample Payloads → included in each notebook.
- Mock Endpoints → provided during SP-API in person workshops for safe submission. If you have your own Mock Endpoints developed feel free to use them in the variables listed instead.
- Clues & Hints → embedded in notebooks to guide you.

---

## 🏆 The Wizard’s Glory

This is a challenge format:
- Work through the notebooks.
- Submit your answers to the mock endpoints provided.