# Elogant

> **Unlock your Hydrocarbon.**

Elogant is a comprehensive petrophysical analysis and well log visualization platform. It is designed to assist petrophysicists and geoscientists in efficiently processing, analyzing, and reporting on well logs. Elogant provides powerful math calculation engines for computing the volume of clay, porosity, and water saturation, all wrapped in a premium and responsive user interface.

## 🚀 Features

- **Robust Parsing:** Easily upload and parse `.las` and ASCII formatted files.
- **Petrophysical Engine:** Comprehensive suite of models including Archie for Water Saturation, and algorithms for Porosity (Density, Neutron, Sonic) and Clay Volume (GR, SP, RT, ND).
- **AI/ML Workflows:** Integrated XGBoost and Linear Regression engines for sonic log prediction and interpolation.
- **Dynamic Scenarios:** Save, manage, and recall calculation scenarios easily.
- **Automated Reporting:** Generate comprehensive PDF reports natively.

## 🛠 Tech Stack

**Frontend:**
- [Next.js](https://nextjs.org/) (React framework)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)

**Backend:**
- [FastAPI](https://fastapi.tiangolo.com/) (High-performance Python API framework)
- [Pandas](https://pandas.pydata.org/) & [NumPy](https://numpy.org/) for fast data processing
- [Scikit-learn](https://scikit-learn.org/) & [XGBoost](https://xgboost.readthedocs.io/) for Machine Learning
- [ReportLab](https://www.reportlab.com/) for PDF generation
- **Database:** SQLite

## 💻 Getting Started

The project is structured as a unified monorepo.

### 1. Backend Setup
Set up your Python virtual environment and start the FastAPI server:
```bash
# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the API server
python -m uvicorn backend.main:app --reload --port 8000
```
The API documentation will be available at `http://localhost:8000/docs`.

### 2. Frontend Setup
In a new terminal window, install your node modules and run the Next.js dev server:
```bash
npm install
npm run dev
```
Open `http://localhost:3000` to view the application.

## 📄 License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for more information.
