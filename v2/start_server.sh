#!/bin/bash
cd /home/user/Claude-PDF-to-Word-converter/v2
source venv/bin/activate
cd backend
export PYTHONPATH=/home/user/Claude-PDF-to-Word-converter/v2:$PYTHONPATH
python app.py
