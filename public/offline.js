try {
  const primary = JSON.parse(
    localStorage.getItem('ele2026:primary:' + location.pathname) || 'null',
  );
  const query =
    primary?.version === 1 ? primary.query : location.pathname === '/' ? 'scope=br&office=1' : null;
  const last = query ? JSON.parse(localStorage.getItem('ele2026:' + query) || 'null') : null;
  const snapshot = last?.version === 1 ? last.view?.resource?.current : null;
  if (snapshot) {
    const scope = document.createElement('h2');
    scope.textContent =
      snapshot.data.officeName + ' · ' + (primary?.label ?? snapshot.data.scope.toUpperCase());
    document.getElementById('results').append(scope);
    const time = new Date(snapshot.source.fetchedAt).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
    });
    document.getElementById('status').textContent =
      'Sem conexão. Exibindo último resultado recebido às ' + time + '.';
    if (
      snapshot.data.phase === 'unreleased' ||
      (snapshot.data.office === '1' && Date.now() < Date.parse(last.view.releaseAt))
    ) {
      const message = document.createElement('p');
      message.textContent = 'Apuração ainda não liberada no último arquivo recebido.';
      document.getElementById('results').append(message);
    } else
      for (const candidate of snapshot.data.candidates) {
        const article = document.createElement('article'),
          name = document.createElement('strong'),
          value = document.createElement('span');
        name.textContent = candidate.name + ' · ' + candidate.party;
        value.textContent =
          (candidate.percentage === null ? 'Percentual indisponível' : candidate.percentage + '%') +
          ' · ' +
          (candidate.votes === null
            ? 'Votos indisponíveis'
            : candidate.votes.toLocaleString('pt-BR') + ' votos');
        article.append(name, value);
        document.getElementById('results').append(article);
      }
  }
} catch {}
