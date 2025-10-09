# 🧪 SP-API Labs

Welcome to the **SP-API Labs**!  
This directory contains hands-on resources to help you learn and master the **Selling Partner API (SP-API)** through code samples, guided tutorials, and full workshop challenges.

---

## 📂 Structure

- **`tutorials/`**  
  Step-by-step Jupyter notebooks that guide you through individual workflows.  
  - Ideal if you want to learn and test one API domain in detail.  
  - Example: querying with the Data Kiosk API.

- **`workshops/`**  
  End-to-end labs that combine multiple APIs to solve a real-world problem.  
  - Ideal for deeper learning and real world usecase understandings. 
  - Example: diagnosing listing errors, or building a fulfillment solution with Buy Shipping + MLI.

- **`server/`**  
  A  mock server that powers the [tutorials](https://github.com/amzn/selling-partner-api-samples/tree/hands-on-labs/labs/tutorials) and [workshops](https://github.com/amzn/selling-partner-api-samples/tree/hands-on-labs/labs/workshops).  
  - Run this locally to simulate SP-API endpoints.  
  - **Purpose:** help you understand the **flow of the APIs** without calling SP-API production endpoints.  
  - Example: test Listings Wizard or Shipping Guru without hitting live SP-API.

---

## Quick Start Command

Open Terminal run the following:
```bash
  cd selling-partner-api-samples/labs/server
  sh setup.sh
```

Open a new terminal and run:
```bash
   cd selling-partner-api-samples/labs
   jupyter lab .
```

📝 This will open Jupyer Lab web version and load the labs directory folder. 
In the directory section of Jupyter you would be able to navigate to different workshops, and tutorials.

## 📚 Quick Access Table

| Category     | Folder                                                                                      | Description                                                                 | Example                                                |
|--------------|---------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------|--------------------------------------------------------|
| 📖 Tutorials | [`tutorials/`](https://github.com/amzn/selling-partner-api-samples/tree/hands-on-labs/labs/tutorials) | Guided Jupyter notebooks focused on a single API workflow                   | Querying SKU economics with Data Kiosk                 |
| 🏋️ Workshops | [`workshops/`](https://github.com/amzn/selling-partner-api-samples/tree/hands-on-labs/labs/workshops) | Multi-step challenges combining multiple APIs to solve real-world problems   | Listing error diagnosis, Fulfillment workflows with MLI |
| 🖥 Server    | [`server/`](https://github.com/amzn/selling-partner-api-samples/tree/hands-on-labs/labs/server)       | Mock server to run tutorials and workshops locally, and understand API flows | Listings Wizard, Data Kiosk, Shipping Guru             |


