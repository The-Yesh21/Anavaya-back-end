import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import LabelEncoder
import pandas as pd
import numpy as np

# Simple Neural Network for Case Priority
class CasePriorityNN(nn.Module):
    def __init__(self, input_size, hidden_size, num_classes):
        super(CasePriorityNN, self).__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.relu = nn.ReLU()
        self.fc2 = nn.Linear(hidden_size, num_classes)
        self.softmax = nn.Softmax(dim=1)
        
    def forward(self, x):
        out = self.fc1(x)
        out = self.relu(out)
        out = self.fc2(out)
        return out


# Prefer the NVIDIA GPU when PyTorch can see one (CUDA); otherwise fall back
# to CPU. All tensors and the model are moved onto this device below.
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _describe_device(device: torch.device) -> str:
    if device.type == "cuda":
        return f"NVIDIA GPU: {torch.cuda.get_device_name(device)}"
    return "CPU (no CUDA GPU detected)"


def train_dl_model(device: torch.device | None = None, num_epochs: int = 50):
    """Train the CasePriorityNN on the synthetic corpus.

    device: torch device to train on (default: CUDA GPU when available).
    """
    device = device or DEVICE
    print(f"Training deep learning model on {_describe_device(device)}...")

    # Load data
    df = pd.read_csv('case_priority_system/data/synthetic_cases.csv')
    
    # NLP Preprocessing (TF-IDF for simplicity in this demo)
    tfidf = TfidfVectorizer(max_features=500)
    X_text = tfidf.fit_transform(df['description']).toarray()
    
    # Target Encoding
    le = LabelEncoder()
    y = le.fit_transform(df['priority'])
    
    # Convert to Tensors (moved onto the training device)
    X_tensor = torch.tensor(X_text, dtype=torch.float32, device=device)
    y_tensor = torch.tensor(y, dtype=torch.long, device=device)
    
    # Hyperparameters
    input_size = X_text.shape[1]
    hidden_size = 64
    num_classes = len(le.classes_)
    learning_rate = 0.001
    
    # Model, Loss, Optimizer (model lives on the device too)
    model = CasePriorityNN(input_size, hidden_size, num_classes).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    
    # Training Loop
    print("Starting Deep Learning Model Training...")
    for epoch in range(num_epochs):
        # Forward pass
        outputs = model(X_tensor)
        loss = criterion(outputs, y_tensor)
        
        # Backward and optimize
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        
        if (epoch+1) % 10 == 0:
            print(f'Epoch [{epoch+1}/{num_epochs}], Loss: {loss.item():.4f}')
            
    # Save Model (state_dict is device-agnostic; record the device used)
    torch.save({
        'model_state_dict': model.state_dict(),
        'tfidf': tfidf,
        'label_encoder': le,
        'input_size': input_size,
        'hidden_size': hidden_size,
        'num_classes': num_classes,
        'device': str(device),
    }, 'case_priority_system/models/priority_dl_model.pth')
    print(f"Deep Learning model saved (trained on {device}).")


if __name__ == "__main__":
    train_dl_model()
