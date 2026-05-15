#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Freelance AI Suite - Setup${NC}"
echo -e "${BLUE}========================================${NC}"

if [ ! -f .env ]; then
  echo -e "${GREEN}>>> Creating .env from .env.example${NC}"
  cp .env.example .env
else
  echo -e "${YELLOW}>>> .env already exists, skipping${NC}"
fi

echo -e "${GREEN}>>> Creating data directory${NC}"
mkdir -p data

echo -e "${GREEN}>>> Installing root dependencies${NC}"
npm install

echo -e "${GREEN}>>> Installing shared workspace${NC}"
npm install --workspace shared

echo -e "${GREEN}>>> Installing server workspace${NC}"
npm install --workspace server

echo -e "${GREEN}>>> Installing client workspace${NC}"
npm install --workspace client

echo -e "${GREEN}>>> Building shared types${NC}"
npm run build --workspace shared

echo -e "${GREEN}>>> Running database migrations${NC}"
npm run db:migrate --workspace server || true

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}  Setup complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Edit ${BLUE}.env${NC} and add your ${BLUE}ANTHROPIC_API_KEY${NC}"
echo -e "     (get one at https://console.anthropic.com/)"
echo -e "  2. Run ${BLUE}npm run dev${NC}"
echo -e "  3. Open ${BLUE}http://localhost:5173${NC}"
echo ""
