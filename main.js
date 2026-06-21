// ================================
// ① DB読み込み
// ================================
let pokemonDB = [];
let ingredientEnergyDB = {};

async function loadDB() {
  const p = await fetch("pokemon_data.json");
  pokemonDB = await p.json();

  const e = await fetch("ingredient_energy.json");
  ingredientEnergyDB = await e.json();

  populatePokemonSelect();
}

loadDB();


// ================================
// ② UIにポケモン一覧を流し込む
// ================================
function populatePokemonSelect() {
  const select = document.getElementById("pokemonSelect");
  select.innerHTML = "";

  pokemonDB.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.name;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}


// ================================
// ③ きのみ個数ロジック
// ================================
function getBerryCount(pokemon, hasBerryS) {
  let base = (pokemon.category === "きのみ" || pokemon.category === "オール") ? 2 : 1;
  if (hasBerryS) base += 1;
  return base;
}


// ================================
// ④ 食材枠解放
// ================================
function getUnlockedSlots(level) {
  if (level < 30) return [1];
  if (level < 60) return [1, 2];
  return [1, 2, 3];
}


// ================================
// ⑤ 食材枠抽選
// ================================
function chooseIngredientSlot(unlocked) {
  const i = Math.floor(Math.random() * unlocked.length);
  return unlocked[i];
}


// ================================
// ⑥ 食材の種類と個数
// ================================
function getIngredientFromSlot(pokemon, slot) {
  if (slot === 1) {
    return { ingredient: pokemon.ingredientA, count: pokemon["a1"] };
  }

  if (slot === 2) {
    const choices = [];
    if (pokemon["a2"] !== undefined)
      choices.push({ ingredient: pokemon.ingredientA, count: pokemon["a2"] });
    if (pokemon["b2"] !== undefined)
      choices.push({ ingredient: pokemon.ingredientB, count: pokemon["b2"] });

    return choices[Math.floor(Math.random() * choices.length)];
  }

  if (slot === 3) {
    const choices = [];
    if (pokemon["a3"] !== undefined)
      choices.push({ ingredient: pokemon.ingredientA, count: pokemon["a3"] });
    if (pokemon["b3"] !== undefined)
      choices.push({ ingredient: pokemon.ingredientB, count: pokemon["b3"] });
    if (pokemon["c3"] !== undefined)
      choices.push({ ingredient: pokemon.ingredientC, count: pokemon["c3"] });

    return choices[Math.floor(Math.random() * choices.length)];
  }
}


// ================================
// ⑦ 食材エナジー計算
// ================================
function calcIngredientEnergy(name, count) {
  const per = ingredientEnergyDB[name] ?? 0;
  return per * count;
}


// ================================
// ⑧ お手伝い1回の結果
// ================================
function simulateOneHelp(pokemon, level, hasBerryS) {
  const fr = pokemon.foodRate;
  const isFood = Math.random() < fr;

  let result = {};

  if (isFood) {
    const unlocked = getUnlockedSlots(level);
    const slot = chooseIngredientSlot(unlocked);
    const { ingredient, count } = getIngredientFromSlot(pokemon, slot);
    const energy = calcIngredientEnergy(ingredient, count);

    result = {
      type: "ingredient",
      ingredient,
      count,
      energy
    };

  } else {
    const count = getBerryCount(pokemon, hasBerryS);
    const energy = count * pokemon.berryEnergy;

    result = {
      type: "berry",
      count,
      energy
    };
  }

  // スキル抽選（独立）
  const sr = pokemon.skillRate;
  result.skill = Math.random() < sr;

  return result;
}


// ================================
// ⑨ 1日の期待値計算
// ================================
function calcDailyExpectation(pokemon, level, hasBerryS) {
  const helpTime = pokemon.helpTime;
  const helpsPerDay = 86400 / helpTime;

  const fr = pokemon.foodRate;
  const br = 1 - fr;

  // きのみ期待値
  const berryCount = getBerryCount(pokemon, hasBerryS);
  const berryEnergyPerHelp = berryCount * pokemon.berryEnergy;

  // 食材期待値
  const unlocked = getUnlockedSlots(level);
  const slotProb = 1 / unlocked.length;

  let ingredientEnergyPerHelp = 0;

  for (const slot of unlocked) {
    const choices = [];

    if (slot === 1) {
      choices.push({ ingredient: pokemon.ingredientA, count: pokemon["a1"] });
    } else if (slot === 2) {
      if (pokemon["a2"] !== undefined)
        choices.push({ ingredient: pokemon.ingredientA, count: pokemon["a2"] });
      if (pokemon["b2"] !== undefined)
        choices.push({ ingredient: pokemon.ingredientB, count: pokemon["b2"] });
    } else if (slot === 3) {
      if (pokemon["a3"] !== undefined)
        choices.push({ ingredient: pokemon.ingredientA, count: pokemon["a3"] });
      if (pokemon["b3"] !== undefined)
        choices.push({ ingredient: pokemon.ingredientB, count: pokemon["b3"] });
      if (pokemon["c3"] !== undefined)
        choices.push({ ingredient: pokemon.ingredientC, count: pokemon["c3"] });
    }

    const choiceProb = 1 / choices.length;

    for (const c of choices) {
      const e = calcIngredientEnergy(c.ingredient, c.count);
      ingredientEnergyPerHelp += slotProb * choiceProb * e;
    }
  }

  const skillEnergyPerHelp = 0;

  const energyPerHelp =
    br * berryEnergyPerHelp +
    fr * ingredientEnergyPerHelp +
    skillEnergyPerHelp;

  const dailyEnergy = helpsPerDay * energyPerHelp;

  return {
    helpsPerDay,
    berryEnergyPerHelp,
    ingredientEnergyPerHelp,
    energyPerHelp,
    dailyEnergy
  };
}


// ================================
// ⑩ UIイベント接続
// ================================
document.getElementById("calcButton").addEventListener("click", () => {
  const name = document.getElementById("pokemonSelect").value;
  const level = Number(document.getElementById("levelInput").value);
  const hasBerryS = document.getElementById("berrySCheckbox").checked;

  const pokemon = pokemonDB.find(p => p.name === name);
  if (!pokemon) return;

  const result = calcDailyExpectation(pokemon, level, hasBerryS);

  displayResult(result);
});


// ================================
// ⑪ 結果表示
// ================================
function displayResult(r) {
  const box = document.getElementById("result");
  box.classList.add("pks-has-result");

  box.innerHTML = `
    <div class="pks-result-headline">
      <span class="pks-result-num">${Math.round(r.dailyEnergy)}</span>
      <span class="pks-result-unit">エナジー / 日</span>
    </div>

    ・1日の行動回数：${r.helpsPerDay.toFixed(2)} 回<br>
    ・きのみ期待値：${r.berryEnergyPerHelp.toFixed(1)} / 回<br>
    ・食材期待値：${r.ingredientEnergyPerHelp.toFixed(1)} / 回<br>
    ・1回のお手伝い期待値：${r.energyPerHelp.toFixed(1)}<br>
  `;
}
