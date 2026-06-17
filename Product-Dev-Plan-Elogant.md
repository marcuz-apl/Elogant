# Elogant Product Development Roadmap



## Intro and Vision

Elogant is to be developed as an intelligent well logging and data interpretation platform, serving the Oil and Gas industry mainly. It streamline operations with automated insights and highly accurate predictions. The platform shall be developed in a way that the interpretation is transparent and can be reproduced.

The comparable products in the industry are:

- Schlumberger - Techlog
- LR Senergy - Interactive Petrophysics (IP)
- GeolOil - GeolOil

The product features:

- Advanced analytics and reporting capabilities
- Seamless integration with existing systems
- Real-time data monitoring and alerts
- Enterprise-grade security and compliance



## Ultimate Development Objectives

To develop a easy-to-use, simple, but powerful, full-range Petrophysical analysis web app with sleek interface.



## Function Design

Function wise, the `Elogant` suite includes:

- Data Loading: Typically LAS or Text (tab/comma/space-delimited) per Oil and gas industry
- initial Log presentation in tracks: at least 3 tracks, refer to the python code attached. The Log can be grouped into several intervals based on the geological setting. 
- Data wrangling module shall be developed: cleansing, de-spiking, merging, handling overlapped log intervals due to different hole size, etc. (if the log data are in good standing, then data wrangling can be skiped)
- A Settings/Parameters window shall be in place, including the cut-offs of VCL, PHIe and Sw. prior to the calculation later.  
- A powerful engine to calculate VCL (or VSH), Porosity (Total PHIt and Effective PHIe), and Water Saturation (Sw). Then calculate NetRock, NetReservoir, and NetPay, plus Net-to-Gross Ratio.
- Plot function to display the original logs with the newly interpreted VCL, Porosities and Sw, etc.
- A Final plots for "Petrophysical Analysis" in grouped intervals.
- Reporting Module.


## Development Requirements

- A Python codebase, in Jupyter Notebook format, is ready in the folder `./PytroFizik`, please read the README.md and go through Jupyter Notebook, Python scripts for how the Log Analysis is done in Energy Sector.
- Please advise the coding language, Python is strongly preferred since we are going to engage this product to be fully machine-learning based, AI-driven.
- Please prepare and advise proper AGENTS.md and rules (such as: ./agents/reload.md) and install skills as needed.
- Please design a feasible functions/modules as per Section: Function Design above.
- A database shall be in place to save user info, log data, and Petrophysical analysis results.

## Backend Design
- Backend written in Python, using FastAPI framework.
- Backend should expose a RESTful API for the frontend to consume.
- Backend should use SQLite for data storage.

    
## Frontend Design
- The Interface shall learn from the sister project: ../ResoLogix, This is VERY IMPORTATANT!
- Most likely the frontend engine is React/NextJS, but you may advise if another is better.
- Please make it sleek, easy-to-use, simple, but powerful. (the user is petrophysicist, not IT geek)
- Main interface shall start with the landing page which includes the company logo and name of Elogant in the center, Docs, Blog and About at left corner (there shall be a hamburger menu for mobile view to access the Docs, Blog and About buttons), Login/signup at right corner (there shall be a hamburger menu for mobile view to access the login/signup buttons), and ThemeToggler in the top right corner. 
- The Body section will have a sidebar at left, and tool bar/panel at right, and the central part if for the calculation and display of the plots.
- Data loading: A Dashboard will be displayed, including: "Upload Log Data", "Import LAS Data" (LAS format is the de facto industry standard for digital well log data. It is a tab-delimited ASCII file format that contains header information, track information, and curve data.), "Import Text Data" (tab/comma/space-delimited).
- After data is loaded, the user will be redirected to the Initial Display, from there the user will idtifiy if the data wrangling is needed. then a "Data Wrangle" on/off ratio button shall be provided.
  - There shall be a Setting panel at right column, including the parameters needed.
- If "Data Wrangle" is set to ON, the user will be redirected to the Data Wrangle page, from there the user can select the curves to be wrangled, apply the wrangling methods, and preview the wrangled data, and finally save the wrangled data.
- If "Data Wrangle" is set to OFF, the user will be redirected to the Petrophysical Analysis page (Please refer to the code in ./PytroFizik for the petrophysical analysis methods, and the python scripts for how the log analysis is done in Energy Sector), from there the user can apply the petrophysical analysis methods, and preview the results, and finally save the results.
- Reporting Module: A Final Plot Report in PDF format shall be generated, including the plots and the petrophysical analysis results.

## venv management
- uv
- ensure best practices for venv management are followed.