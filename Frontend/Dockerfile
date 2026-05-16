# Frontend Dockerfile for FishChain static site
FROM nginx:stable-alpine

WORKDIR /usr/share/nginx/html
RUN rm -rf ./*
COPY . .

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
