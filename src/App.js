import { useEffect, useState, useRef } from "react";
import * as React from 'react';
import { ethers } from "ethers";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { contract_address, abi, rpc_url, explorer_url } from "./config";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { yellow } from "@mui/material/colors";
import Slider from "@mui/material/Slider";
import "./App.css";


const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

const theme = createTheme({
  palette: {
    primary: {
      // Purple and green play nicely together.
      main: yellow[500]
    },
    secondary: {
      // This is green.A700 as hex.
      main: "#11cb5f"
    }
  }
});

var signer = null;
var _provider = null;
var _address = null;
var refreshing = false;
function App() {
  const [connected, connectedset] = useState(false);
  const [walletaddress, walletaddressset] = useState("");
  const [balance, balanceset] = useState(0);
  const [target, targetset] = useState(0);
  const [days, daysset] = useState(7);
  const [roi, roiset] = useState(0);
  const [totalroi, totalroiset] = useState(0);
  const [connectCaption, setConnectCaption] = useState("Connect");
  const [all, allset] = useState({
    balance: -1,
    perStaked: 0,
    perReward: 0,
    totalStaked: 0,
    totalReward: 0,
  })
  const scrollTarget = useRef(null);
  // const days = useRef(0);
  const AVAXs = useRef(0);
  const [alert, alertset] = useState({
    open: false,
    style: 'success',
    message: "",
  })
  async function connect() {
    try {
      setConnectCaption("Connecting...")
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0xa86a",
          rpcUrls: ["https://api.avax.network/ext/bc/C/rpc"],
          chainName: "Avalanche Mainnet",
          nativeCurrency: {
            name: "AVAX",
            symbol: "AVAX",
            decimals: 18
          },
          blockExplorerUrls: ["https://snowtrace.io/"]
        }]
      });
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xa86a' }]
      });
      const providerOptions = {
        /* See Provider Options Section */
        metamask: {
          id: "injected",
          name: "MetaMask",
          type: "injected",
          check: "isMetaMask",
        },

        walletconnect: {
          package: WalletConnectProvider,
          options: {
            // Mikko's test key - don't copy as your mileage may vary
            infuraId: "8043bb2cf99347b1bfadfb233c5325c0",
          },
        },
      };

      const web3Modal = new Web3Modal({
        cacheProvider: false, // optional
        providerOptions, // required
      });

      let connection = await web3Modal.connect();
      const provider = new ethers.providers.Web3Provider(connection);
      _provider = provider;
      console.log(_provider)
      signer = provider.getSigner();
      connectedset(true);
      var address = await signer.getAddress();
      _address = address
      walletaddressset(address);
      var balance = await provider.getBalance(address);
      // console.log(balance)
      balance = ethers.utils.formatEther(balance);
      console.log(_address, balance)
      balanceset(balance);
      await refresh();
    } catch (err) {
      console.log(err)
      setConnectCaption("Connect")
    }
  }

  function valChange(e) {
    refreshProfit(days);
  }

  function daysChange(e) {
    daysset(e.target.value);
    refreshProfit(e.target.value);
  }

  function refreshProfit(_days) {
    var AVAX = AVAXs.current.value;
    console.log(AVAX)
    var __days = _days;
    var _total = 0;
    var roi = 0;
    if (__days < 14) {
      // _total = AVAX*(1.062**__days);
      roi = 0.062;
    } else if (__days < 21) {
      // _total = AVAX*(1.062 ** 13 * 1.074**(__days-13)); 
      // roi = (0.062 * 13 + 0.074*(__days-13))/__days;
      roi = 0.074;
    } else {
      // _total = AVAX*(1.062 ** 13 * 1.074**7 * 1.093**(__days -20)); 
      // roi = (0.062 * 13 + 0.074*7 + (__days -20)*0.093)/__days;
      roi = 0.093;
    }
    roi = (roi * 100).toFixed(2);
    var totalroi = roi * __days;
    // totalroi += +100;
    _total = AVAX * (+totalroi + 100) / 100;
    totalroiset(totalroi);
    roiset(roi);
    targetset(_total);
  }

  async function refresh() {
    try {
      const provider = new ethers.providers.JsonRpcProvider(rpc_url);
      const contract = new ethers.Contract(contract_address, abi, provider);
      console.log(contract)
      var totalStaked = await contract.totalStaked();
      totalStaked = ethers.utils.formatEther(totalStaked);
      var totalReward = await contract.totalReward();
      totalReward = ethers.utils.formatEther(totalReward);
      var perStaked, perReward, perRewardReal;
      var balance = -1;
      if (_address == null) {
        perStaked = 0;
        perReward = 0;
      } else {
        perStaked = await contract.getPerStaked(_address);
        perStaked = ethers.utils.formatEther(perStaked);
        perReward = await contract.getPerRewardTotal(_address);
        perReward = ethers.utils.formatEther(perReward);
        perRewardReal = await contract.getPerReward(_address);
        perRewardReal = ethers.utils.formatEther(perRewardReal);
      }
      if (_provider && _address) {
        balance = await _provider.getBalance(_address);
        balance = ethers.utils.formatEther(balance)
      }
      var ret = {
        totalStaked, totalReward, balance, perStaked, perReward, perRewardReal,
      }
      console.log(ret)
      allset(ret);
    } catch (err) {
      console.log(err)
    }
  }

  async function stake() {
    try {
      console.log(connected);
      if (signer == null || !connected) {
        alertset({
          open: true,
          style: "error",
          message: `You should connect wallet first.`,
        })
        return;
      }
      let contract = new ethers.Contract(contract_address, abi, signer);
      let tx = await contract.stake(days, {
        value: ethers.utils.parseUnits(AVAXs.current.value, "ether"),
      });
      await tx.wait();
      console.log("success");
      alertset({
        open: true,
        style: "success",
        message: `You successfully staked ${AVAXs.current.value} AVAX..`,
      })
      await refresh();
    } catch (e) {
      alertset({
        open: true,
        style: "error",
        message: `Error`,
      })
    }

  }

  async function withdraw() {
    try {
      if (+all.perReward == 0) {
        alertset({
          open: true,
          style: "error",
          message: `You have no reward to withdraw yet !`,
        })
        return;
      }
      if (signer == null || !connected) {
        alertset({
          open: true,
          style: "error",
          message: `You should connect wallet first.`,
        })
        return;
      }
      let contract = new ethers.Contract(contract_address, abi, signer);

      let tx = await contract.withdrawProfit();
      await tx.wait();
      console.log("success");
      alertset({
        open: true,
        style: "success",
        message: `You successfully withdrawed ${all.perRewardReal} AVAX.  Original Funds will be sent manually later`,
      })
      await refresh();
    } catch (e) {
      alertset({
        open: true,
        style: "error",
        message: `Error`,
      })
    }
  }

  function convertaddress(address) {
    const n = address.length;
    return address.substr(0, 4) + "..." + address.substr(n - 2, n - 1);
  }

  function scroll() {
    scrollTarget.current.scrollIntoView();
  }
  return (
    <div>

      <Snackbar open={alert.open} autoHideDuration={6000} onClose={e => { alertset({ open: false, style: "success", message: "" }) }}>
        <Alert onClose={e => { alertset({ open: false, style: "success", message: "" }) }} severity={alert.style} sx={{ width: "100%" }}>
          {alert.message}
        </Alert>
      </Snackbar>
      <div style={{ backgroundColor: "black" }}>
        <section className="first-screen" style={{ backgroundColor: "black" }}>
          {/* header */}
          <header className="header">
            <div className="container-info">
              <div className="container-header">
                <a href="#" className="container-logo">
                  <div className="logo">
                    <img
                      src="images/avax.png"
                      style={{ width: "50px", height: "50px" }}
                      alt="logo"
                    />
                  </div>
                </a>

                <div className="header-contacts">
                  <div className="container-btn-contacts">
                    {all.balance == -1 && (
                      <button
                        type="button"
                        className="btn-contact connect"
                        id="connectBtn"
                        onClick={async (e) => {
                          await connect();
                        }}
                      >
                        <span id="buttonConnectContent">{connectCaption}</span>
                      </button>
                    )}
                    {all.balance > -1 && (
                      <>
                        <div style={{ color: "white" }}>
                          {convertaddress(walletaddress)}
                        </div>
                        <br />
                        <div style={{ color: "yellow", marginLeft: "35px" }}>
                          {all.balance}AVAX
                        </div>
                      </>
                    )}
                  </div>
                  {/* <ul className="contact-list">
                  <li className="item-list telegram">
                    <a href="https://t.me/AVAX100x" target="_blank" className="item-link" />
                  </li>
                </ul> */}
                </div>
              </div>
            </div>
          </header>
          <div
            className="container-first-screen"
            style={{ backgroundColor: "black" }}
          >
            <div className="container-info">
              <div className="container-info-screen">
                <div className="screen-block">
                  <div className="text-container">
                    <h1 className="main-title">
                      Stable &amp; Profitable Yield Farming Dapp on
                      <span>Avalanche Testnet</span>
                    </h1>
                    <p className="sub-title-main">
                      {/* From 7.8 to <span>17% Daily ROI</span>
                    <br /><span>5 Levels</span> of Referral Rewards */}
                    </p>
                    {/* <button
                      type="button"
                      className="pink-btn mobile-block"
                      onClick={scroll}
                      id="depositRouterButton"
                    >
                      Deposit
                    </button> */}
                  </div>
                </div>
                <div className="screen-block right-screen">
                  <div className="container-result">
                    <div className="block-result">
                      <p className="result" id="totalCurrencyInvested">
                        {all.totalStaked}
                      </p>
                      <div className="sub-text-result">
                        <span>Total</span>
                        <span className="pink-text">AVAX</span>
                        <br />
                        <span className="bold-text">Invested</span>
                      </div>
                    </div>
                    <div className="block-result">
                      <p className="result" id="totalReferralReward">
                        {all.totalReward}
                      </p>
                      <div className="sub-text-result">
                        <span>Total</span>
                        <span className="pink-text">AVAX</span>
                        <br />
                        <span className="bold-text">Reward</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* first section */}
        <section className="section-info">
          <div className="calculate-block-container">
            <div className="container-info">
              <div className="header-section">
                <h2
                  className="title-header"
                  ref={scrollTarget}
                  id="investmentSectionTitle"
                >
                  Calculate Profit
                </h2>
              </div>
              <div
                className="container-calculate-info"
              >
                <div className="container-counter">
                  <div style={{ width: "100%", paddingRight: "10px" }}>
                    <div style={{ paddingBottom: "50px", fontWeight: "bold", fontSize: "16px" }}>Deposit Period: {days} days</div>
                    {/* <ThemeProvider theme={theme}>
                      <Slider defaultValue={7} min ={7} valueLabelDisplay="on" max ={21} step={1} aria-label="Default" color="primary"  style={{marginTop:"39px"}} onChange={daysChange}/>

                    </ThemeProvider> */}
                    <div className="container-slider" id="slider-container">
                      <input id="js-slider" style={{ width: "100%" }} className="container-slider-range ui-slider ui-slider-horizontal ui-widget ui-widget-content ui-corner-all" type="range" min="7" max="21" onInput={e => { daysset(e.target.value); daysChange(e) }} />
                      <div className="container-slider-range ui-slider ui-slider-horizontal ui-widget ui-widget-content ui-corner-all" id="js-slider" style={{ pointerEvents: "none" }}><div className="slider-range-inverse" style={{ width: '0%' }} />
                        <div className="ui-slider-range ui-widget-header ui-corner-all ui-slider-range-min" style={{ width: '78.5714%' }} /><span className="ui-slider-handle ui-state-default ui-corner-all" tabIndex={0} style={{ left: `${(days - 7) / 14 * 100}%` }}><span className="mark" id="depositPeriodDays">{days}</span><span className="dot"><span className="handle-track" style={{ width: '598px', left: '-107.64px' }} /></span></span></div>
                      <ul id="tickmarks" className="datalist">
                        <li>7</li>
                        {/* <li>20</li> */}
                        <li > 21</li>
                      </ul>
                    </div>


                  </div>


                  {/* <ThemeProvider theme={theme}>
                    <Slider
                      aria-label="Temperature"
                      defaultValue={30}
                      getAriaValueText={valuetext}
                      color="primary"
                    />
                    <Button>Primary</Button>
                    <Button color="secondary">Secondary</Button>
                  </ThemeProvider> */}
                  {/* <div
                    className="deposit-block deposit"
                    style={{ color: "yellow" }}
                  >
                    <h3 className="title-deposit" style={{ color: "yellow" }}>
                      Deposit Period (days):
                    </h3>
                    <div className="amount-field" style={{ width: "50%" }}>
                      <input
                        type="number"
                        ref={days}
                        id="depositAmount"
                        className="amount-input"
                        defaultValue={1}
                        min={0}
                      />
                      <button
                        className="amount-field-button"
                        id="maxAmountButton"
                        onClick={(e) => {
                          days.current.value = 15;
                        }}
                      >
                        Max
                      </button>
                    </div>
                  </div> */}
                  <div className="container-counter-amount">
                    <div className="deposit-block">
                      <h3
                        className="title-deposit amount-title"
                      >
                        Deposit Amount:
                      </h3>
                      <div className="amount-field">
                        <input
                          type="number"
                          ref={AVAXs}
                          id="depositAmount"
                          className="amount-input"
                          defaultValue={1}
                          onChange={e => valChange(e)}
                          min={0}
                        />
                        <button
                          className="amount-field-button"
                          id="maxAmountButton"
                          onClick={(e) => {
                            AVAXs.current.value = balance;
                          }}
                        >
                          Max
                        </button>
                      </div>
                    </div>
                  </div>

                </div>

                <div className="footer-counter">

                  <div className="container-footer-info">
                    <ul className="list-info">
                      <li className="item-info">
                        <h4 className="title-info" >
                          {`Daily ROI:`}
                        </h4>
                        <p id="dailyRoi" >{`${roi} %`}</p>
                      </li>
                      <li className="item-info">
                        <h4 className="title-info" >
                          Total Profit
                        </h4>
                        <p id="totalProfitPercent" >{`${(totalroi).toFixed(2)} %`}</p>
                      </li>
                      {/* <li className="item-info">
                        <h4 className="title-info" >
                          After 21 days:
                        </h4>
                        <p id="totalProfitPercent" >114.8%</p>
                      </li> */}
                      <li className="item-info">
                        <h4 className="title-info" >
                          In <span id="days" style={{ color: "red" }}>{days}</span> days
                          you will earn:
                        </h4>
                        <p className="pink-text">
                          <span id="profitCurrencyValue">{target.toFixed(2)}</span> <span>AVAX</span>
                        </p>
                      </li>
                    </ul>

                  </div>
                  <button
                    type="button"
                    className="pink-btn invest-btn"
                    id="investButton"
                    onClick={async (e) => {
                      await stake();
                    }}
                  >
                    Stake
                  </button>
                  {/* <button
                    type="button"
                    className="pink-btn invest-btn"
                    id="investButton"
                    onClick={async (e) => {
                      await stake();
                    }}
                  >
                    Invest
                  </button> */}
                </div>
              </div>
            </div>
          </div >
        </section >
        <div
          className="links-row"
          style={{ backgroundColor: "black", padding: "0px" }}
        >
          <div className="links-row__wrap">
            {/* <a className="link-icon" href="#get_started_section">
            <span className="link-icon__img"><img src="images/info.svg" alt="Info" /></span><span className="h6">Info</span>
          </a> */}
            <a
              href="https://snowtrace.io/address/0xD3fa250D82AA8b71d5034c899af20D8dFfEf5319#code"
              target="_blank"
              className="link-icon"
            >
              <span className="link-icon__img">
                <img src="images/contract.svg" alt="Contract" />
              </span>
              <span className="h6">Contract</span>
            </a>
            {/* <a href="https://t.me/AVAX100x" target="_blank" className="link-icon">
            <span className="link-icon__img"><img src="images/telegram.svg" alt="Telegram" /></span><span className="h6">Telegram</span>
          </a> */}
          </div>
        </div>
        {/* second section */}
        {/* second section */}
        <section
          className="dashboard-section"
          style={{ backgroundColor: "black" }}
        >
          <div className="dashboard-block-container">
            <div className="container-info">
              <div className="header-section">
                <h2 className="title-header">Dashboard</h2>
              </div>
              <div
                className="container-dashboard-info"
                style={{
                  backgroundColor:
                    "linear-gradient( 270deg, #fff700 0%, #ff8800 96.85%)",
                }}
              >
                <div className="container-info-block">
                  <ul className="list-dashboard">
                    <li className="item-dashboard">
                      <div>
                        <h5 className="title-block-item">
                          Withdrawable
                        </h5>
                        <p className="info-item">
                          <span id="toWithdraw">{`${all.perReward}`}</span>
                          <span className="pink-text">AVAX</span>
                        </p>
                      </div>
                    </li>
                    <li className="item-dashboard">
                      <div>
                        <h5 className="title-block-item">Total Invested</h5>
                        <p className="info-item">
                          <span id="investedByUser">{all.perStaked}</span>
                          <span className="pink-text">AVAX</span>
                        </p>
                      </div>
                    </li>
                    <li className="item-dashboard">
                      <div>
                        <h5 className="title-block-item">Total Withdrawal</h5>
                        <p className="info-item">
                          <span id="withdrawalByUser">{all.totalReward}</span>
                          <span className="pink-text">AVAX</span>
                        </p>
                      </div>
                    </li>
                    <li className="item-dashboard">
                      <div>
                        <h5 className="title-block-item">
                          Total Staked
                        </h5>
                        <p className="info-item">
                          <span id="refRewardForUser">{all.totalStaked}</span>
                          <span className="pink-text">AVAX</span>
                        </p>
                      </div>
                    </li>
                  </ul>
                  <button
                    type="button"
                    className="pink-btn withdraw-btn"
                    id="withdrawButton"
                    onClick={async e => { await withdraw() }}
                  >
                    Unstake
                  </button>

                  {/* <div className="container-footer-dashboard">
                  <h3 className="title-footer-dashboard">
                    Your Referral Link:
                    <span id="refLink">You will get your ref link after investing</span>
                    <button className="btn-copy" id="copyButton" />
                    <span className="title-copy" id="copiedSuccessfully" style={{ display: 'none' }}>Copied successfully !</span>
                  </h3>
                  <ul className="list-footer">
                    <li className="item-footer">
                      <h3 className="title-level">
                        1 LVL
                      </h3>
                      <p className="info-level">
                        <span id="referralsCountAtLevel1">0</span> referrals
                      </p>
                      <p className="info-level">
                        4% Referral Rewards
                      </p>
                    </li>
                    <li className="item-footer">
                      <h3 className="title-level second-level">
                        2 LVL
                      </h3>
                      <p className="info-level">
                        <span id="referralsCountAtLevel2">0</span> referrals
                      </p>
                      <p className="info-level">
                        2% Referral Rewards
                      </p>
                    </li>
                    <li className="item-footer">
                      <h3 className="title-level three-level">
                        3 LVL
                      </h3>
                      <p className="info-level">
                        <span id="referralsCountAtLevel3">0</span> referrals
                      </p>
                      <p className="info-level">
                        1% Referral Rewards
                      </p>
                    </li>
                    <li className="item-footer">
                      <h3 className="title-level fourth-level">
                        4 LVL
                      </h3>
                      <p className="info-level">
                        <span id="referralsCountAtLevel4">0</span> referrals
                      </p>
                      <p className="info-level">
                        0.5% Referral Rewards
                      </p>
                    </li>
                    <li className="item-footer">
                      <h3 className="title-level fifth-level">
                        5 LVL
                      </h3>
                      <p className="info-level">
                        <span id="referralsCountAtLevel5">0</span> referrals
                      </p>
                      <p className="info-level">
                        0.1% Referral Rewards
                      </p>
                    </li>
                  </ul>
                </div> */}
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* <section className="dashboard-section security-section" style={{ backgroundColor: "black" }}>
        <div className="dashboard-block-container">
          <div className="container-info">
            <div className="header-section">
              <h2 className="title-header">
                SECURITY
              </h2>
            </div>
            <div className="container-dashboard-info">
              <div className="card" data-sr-id={12} style={{ visibility: 'visible', opacity: 1, transform: 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)', transition: 'opacity 1s cubic-bezier(0.5, 0, 0, 1) 0s, transform 1s cubic-bezier(0.5, 0, 0, 1) 0s' }}>
                <div className="row">
                  <a href="https://bscscan.com/address/0xCFAbfb6F5492D694ac1c89a042e64e66Ad828Ed2#readContract" target="_blank" className="logo"><img style={{ width: '100%' }} src="/images/bscscan.png" alt="SECURITY" /></a><span className="divider" />
                  <h6>Our smart contract is renounced to Zero Address. There is no control of owner and cannot withdraw funds.</h6>
                  <a href="https://bscscan.com/address/0xCFAbfb6F5492D694ac1c89a042e64e66Ad828Ed2#readContract" target="_blank" className="button"><span>Verify Owner</span></a>
                </div>
              </div>
            </div>
             
          </div>
        </div>
      </section> */}
        <section
          id="get_started_section"
          className="dashboard-section getstarted-section"
          style={{ backgroundColor: "black" }}
        >
          <div className="dashboard-block-container">
            <div className="container-info">
              <div className="header-section">
                <h2 className="title-header">Get Started</h2>
              </div>
              <div className="container-dashboard-info">
                <div
                  className="card"
                  data-sr-id={13}
                  style={{
                    visibility: "visible",
                    opacity: 1,
                    transform:
                      "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)",
                    transition:
                      "opacity 1s cubic-bezier(0.5, 0, 0, 1) 0s, transform 1s cubic-bezier(0.5, 0, 0, 1) 0s",
                  }}
                >
                  <div className="start-item">
                    <div className="start-item__num">1</div>
                    <div className="col">
                      <h5>Create a Wallet</h5>
                      <h6>
                        Download{" "}
                        <a href="https://metamask.io/" target="_blank">
                          MetaMask
                        </a>{" "}
                        or{" "}
                        <a href="https://trustwallet.com/" target="_blank">
                          TrustWallet
                        </a>{" "}
                        and create a wallet. Add the Avalanche Testnet to your
                        network-list.
                        <a
                          href="https://academy.binance.com/en/articles/connecting-metamask-to-binance-smart-chain"
                          target="_blank"
                        >
                          Guide here
                        </a>
                      </h6>
                    </div>
                  </div>
                  <div className="start-item">
                    <div className="start-item__num">2</div>
                    <div className="col">
                      <h5>Get AVAX</h5>
                      <h6>
                        Buy AVAX on an exchange (i.e.{" "}
                        <a href="https://www.binance.com/en" target="_blank">
                          Binance
                        </a>
                        ). Transfer AVAX to your wallet address. BEP-20 addresses
                        start with a "0x"
                      </h6>
                    </div>
                  </div>
                  <div className="start-item">
                    <div className="start-item__num">3</div>
                    <div className="col">
                      <h5>Connect your Wallet</h5>
                      <h6>
                        At the top of the site, click "Connect wallet", confirm
                        the action, after which you should see the numbers of
                        your wallet
                      </h6>
                    </div>
                  </div>
                  <div className="start-item">
                    <div className="start-item__num">4</div>
                    <div className="col">
                      <h5>Make a deposit</h5>
                      <h6>
                        Click on the "Deposit" button. In the window that opens,
                        enter the amount, click again on the "Deposit" button
                        and confirm the action
                      </h6>
                    </div>
                  </div>
                  <div className="start-item">
                    <div className="start-item__num">5</div>
                    <div className="col">
                      <h5>Get dividends!</h5>
                      <h6>
                        You have successfully created a deposit! Now every
                        second you will receive dividends that you can withdraw
                        at any time by clicking on the "Withdraw" button
                      </h6>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        {/* footer */}
        <footer
          className="footer bg-black"
          style={{ backgroundColor: "black" }}
        >
          <div className="container-info">
            <div className="container-footer-info">
              <div className="mobile-flex">
                <div className="container-logo-footer">
                  <span>© 2021</span>
                  <span className="logo-span"></span>
                </div>
                {/* <ul className="contact-list mobile-fade">
                  <li className="item-list telegram">
                    <a
                      href="https://t.me/AVAX100x"
                      target="_blank"
                      className="item-link"
                    />
                  </li>
                </ul> */}
              </div>
              <div className="container-footer-btn">
                {/* <button
                  type="button"
                  id="contractLink"
                  className="pink-btn footer-btn-contact"
                >
                  Smartcontract
                </button> */}
                <div className="container-list-contact">
                  {/* <button target="_blank" onclick="window.location.href='https://hazecrypto.net/audit/AVAX-matrix'"  class="btn-contact">
                    <span>Audit</span>
                </button> */}
                  {/* <button type="button" className="btn-contact faq-btn">
                  <span>Faq</span>
                </button> */}
                  {/* <ul className="contact-list mobile-block-list">
                    <li className="item-list telegram">
                      <a
                        href="https://t.me/AVAX100x"
                        target="_blank"
                        className="item-link"
                      />
                    </li>
                  </ul> */}
                </div>
              </div>
            </div>
          </div>
        </footer>

        {/* scripts */}
      </div >
    </div >
  );
}

export default App;
