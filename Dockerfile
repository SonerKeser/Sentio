# Sentio sunucusu: web arayüzü + .NET 10 sunucu tek kapsayıcıda.
# docker compose up -d  →  http://localhost:5757

FROM node:22-alpine AS web
WORKDIR /kaynak/web
COPY web/package.json web/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npx vite build --outDir /cikti/wwwroot --emptyOutDir

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS sunucu
WORKDIR /kaynak
COPY Directory.Build.props ./
COPY src/Sentio.Sunucu/Sentio.Sunucu.csproj src/Sentio.Sunucu/
RUN dotnet restore src/Sentio.Sunucu/Sentio.Sunucu.csproj
COPY src/Sentio.Sunucu/ src/Sentio.Sunucu/
RUN dotnet publish src/Sentio.Sunucu/Sentio.Sunucu.csproj -c Release -o /cikti/uygulama --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /uygulama
COPY --from=sunucu /cikti/uygulama ./
COPY --from=web /cikti/wwwroot ./wwwroot
RUN mkdir -p /veri /uygulama/indirmeler && chown -R app:app /veri /uygulama/indirmeler
ENV Urls=http://+:5757 \
    Sentio__VeriKlasoru=/veri \
    Sentio__AcilistaTarayiciAc=false
EXPOSE 5757
VOLUME ["/veri"]
USER app
ENTRYPOINT ["dotnet", "Sentio.Sunucu.dll"]
