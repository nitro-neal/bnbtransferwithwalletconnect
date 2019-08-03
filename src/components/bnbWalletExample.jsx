import "@fortawesome/fontawesome-free/css/all.min.css";
import "bootstrap-css-only/css/bootstrap.min.css";
import "mdbreact/dist/css/mdb.css";

import React, {Component} from 'react';
import WalletConnect from "@walletconnect/browser";
import WalletConnectQRCodeModal from "@walletconnect/qrcode-modal";
import BnbApiClient from "@binance-chain/javascript-sdk";
import Transaction from "@binance-chain/javascript-sdk/lib/tx";
import {MDBBtn, MDBContainer, MDBRow, MDBCol} from "mdbreact";
import axios from "axios";

const api = 'https://dex.binance.org/'; /// api string
const bnbClient = new BnbApiClient(api);
bnbClient.chooseNetwork("mainnet"); // or this can be "mainnet"
bnbClient.initChain();

//*** Your Private Key and Address to transfer to ***/
let privKeyJson = {}
let privKey;
let addressToTransferTo;
// privKey = BnbApiClient.crypto.getPrivateKeyFromKeyStore(privKeyJson, "YOUR-PASSWORD")
// addressToTransferTo = "YOUR-BNB-ADDRESS-TO-TRANSFER-TO"

const INITIAL_STATE = {
    walletConnector: null,
    fetching: false,
    connected: false,
    chainId: 1,
    showModal: false,
    pendingRequest: false,
    uri: "",
    accounts: [],
    address: "",
    result: null,
    assets: [],

    privateKeyWorkflowAddress: "",
    privateKeyWorkflowSignedTx: "",
    privateKeySignature : "",
    privateKeySignaturePubKey : "",
    privateKeyWorkflowSerializedSignedTx: "",

    walletConnectWorkflowSignedTx: "",
    walletConnectSignature : "",
    walletConnectSignaturePubKey : "",
    walletConnectWorkflowSerializedSignedTx: "",
  };

async function getSequenceNumber(address) {
    const sequenceURL = `${api}api/v1/account/${address}/sequence`;
    const res = await axios.get(sequenceURL);
    return res.data.sequence;
}

async function getAccountNumber(address) {
    const accountURL = `${api}api/v1/account/${address}`;
    const accountNumber = await axios.get(accountURL);
    return accountNumber;
}

 function Decodeuint8arr(uint8array){
    return new TextDecoder("utf-8").decode(uint8array);
}

class BnbWalletExample extends Component {

    state = {
        ...INITIAL_STATE
    }

    // This is the same default signing delegate but I'm exposing it to see the transaction detials
    privateKeyCustomSigningDelegate = async (tx, signMsg) => {
        const signedTx =  tx.sign(privKey, signMsg);
        this.displayTransactionDetails(signedTx, signMsg, "privateKeyWorkflow");

        return signedTx;
    };

    walletConnectCustomSigningDelegate = async (tx, signMsg) => {
        const seqNumber = getSequenceNumber(this.state.address);
        const accountNumber = getAccountNumber(this.state.address);
        

        // Used for swapping tokens
        // const accCode = BnbApiClient.crypto.decodeAddress(this.state.address);
        // const myId = `${accCode.toString("hex")}-${seqNumber + 1}`.toUpperCase();
        
        const transferRequest = {
            id: 1,
            jsonrpc: "2.0",
            method: "bnb_sign",
            params: [
              {
                account_number: accountNumber.toString(),
                chain_id: "Binance-Chain-Tigris",
                data: null,
                memo: "",
                msgs: [signMsg],
                sequence: seqNumber.toString(),
                source: "1"
              }
            ]
          };

        const trustWalletResult = await this.state.walletConnector.sendCustomRequest(transferRequest);
        const resultJsonObject = JSON.parse(trustWalletResult);

        console.log("Trust Wallet Result");
        console.log(trustWalletResult);
        console.log("result object");
        console.log(resultJsonObject);

        const ellipticPublicKey = BnbApiClient.crypto.getPublicKey(resultJsonObject.publicKey);
        const sigBuffer = Buffer.from(resultJsonObject.signature);
        // This is how the private key generates the signature
        // const signature = BnbApiClient.generateSignature(signBytes.toString("hex"), privKeyBuf)

        tx.addSignature(ellipticPublicKey, sigBuffer);

        this.displayTransactionDetails(tx, signMsg, "walletConnectWorkflow");

        return tx;
    };

    displayTransactionDetails = async (signedTx, signMsg, type) => {
        console.log('signedTx');
        console.log(signedTx);
        console.log(JSON.stringify(signedTx));
    
        console.log('signMsg');
        console.log(signMsg);
        console.log(JSON.stringify(signMsg));
    
        console.log('pub_key buffer');
        console.log(signedTx.signatures[0].pub_key);
    
        console.log('signature buffer');
        console.log(signedTx.signatures[0].signature);
    
        console.log('serialized signed tx');
        console.log(signedTx.serialize());
    
        if(type ==="privateKeyWorkflow") {
            this.setState({privateKeyWorkflowSignedTx: JSON.stringify(signedTx)});
            this.setState({privateKeySignaturePubKey: JSON.stringify(signedTx.signatures[0].pub_key)});
            this.setState({privateKeySignature: JSON.stringify(signedTx.signatures[0].signature)});
            this.setState({privateKeyWorkflowSerializedSignedTx: signedTx.serialize()});
        } else if (type === "walletConnectWorkflow") {
            this.setState({walletConnectWorkflowSignedTx: JSON.stringify(signedTx)});
            this.setState({walletConnectSignaturePubKey: JSON.stringify(signedTx.signatures[0].pub_key)});
            this.setState({walletConnectSignature: JSON.stringify(signedTx.signatures[0].signature)});
            this.setState({walletConnectWorkflowSerializedSignedTx: signedTx.serialize()});
        }
        
    }

    walletConnectInit = async () => {
        // bridge url
        // const bridge = "https://bridge.walletconnect.org";
        const bridge = "https://wallet-bridge.binance.org";
    
        // create new walletConnector
        const walletConnector = new WalletConnect({ bridge });
    
        window.walletConnector = walletConnector;
    
        await this.setState({ walletConnector });

        if (walletConnector.connected) {
            console.log('We are connected')
            const { chainId, accounts } = walletConnector;
            const address = accounts[0];
            console.log(address)
            await this.setState({
              connected: true,
              chainId,
              accounts,
              address
            });
          }

        // check if already connected
        if (!walletConnector.connected) {
          // create new session
          await walletConnector.createSession();
    
          // get uri for QR Code modal
          const uri = walletConnector.uri;
    
          // console log the uri for development
          console.log(uri); // tslint:disable-line
    
          // display QR Code modal
          WalletConnectQRCodeModal.open(uri, () => {
            console.log("QR Code Modal closed"); // tslint:disable-line
          });
        }
        // subscribe to events
        await this.subscribeToEvents();
      };

    subscribeToEvents = () => {
        const { walletConnector } = this.state;
    
        if (!walletConnector) {
          return;
        }
    
        walletConnector.on("session_update", async (error, payload) => {
          console.log('walletConnector.on("session_update")'); // tslint:disable-line
    
          if (error) {
            throw error;
          }
    
          const { chainId, accounts } = payload.params[0];
          this.onSessionUpdate(accounts, chainId);
        });
    
        walletConnector.on("connect", (error, payload) => {
          console.log('walletConnector.on("connect")'); // tslint:disable-line
    
          if (error) {
            throw error;
          }
    
          this.onConnect(payload);
        });
    
        walletConnector.on("disconnect", (error, payload) => {
          console.log('walletConnector.on("disconnect")'); // tslint:disable-line
    
          if (error) {
            throw error;
          }
    
          this.onDisconnect();
        });
    
        if (walletConnector.connected) {
          console.log('We are connected')
          const { chainId, accounts } = walletConnector;
          const address = accounts[0];
          console.log(address)
          this.setState({
            connected: true,
            chainId,
            accounts,
            address
          });
        }
    
        this.setState({ walletConnector });
      };
    
    killSession = async () => {
        const { walletConnector } = this.state;
        if (walletConnector) {
          walletConnector.killSession();
        }
        this.resetApp();
      };
    
    resetApp = async () => {
        await this.setState({ ...INITIAL_STATE });
      };
    
    onConnect = async (payload) => {
        console.log(payload.params[0]);
        const { chainId, accounts } = payload.params[0];
        const address = accounts[0];
        await this.setState({
          connected: true,
          chainId,
          accounts,
          address
        });
        WalletConnectQRCodeModal.close();
        // this.getAccountAssets();
      };
    
    onDisconnect = async () => {
        WalletConnectQRCodeModal.close();
        this.resetApp();
      };
    
    onSessionUpdate = async (accounts , chainId) => {
        const address = accounts[0];
        await this.setState({ chainId, accounts, address });
        await this.getAccountAssets();
      };

    sendWithPrivateKey = async () => {
        console.log('START - sendWithPrivateKey');
        
        bnbClient.setPrivateKey(privKey);
        bnbClient.setSigningDelegate(this.privateKeyCustomSigningDelegate);

        const addressFrom = bnbClient.getClientKeyAddress(); // sender address string (e.g. bnb1...)
        const sequence = await getSequenceNumber(addressFrom)

        let result = await bnbClient.transfer(addressFrom, addressToTransferTo, 0.001, "BNB", "", sequence)

        console.log(result);
        console.log(JSON.stringify(result));

        this.setState({privateKeyWorkflowAddress: addressFrom})
    }

    sendWithWalletConnectDelegate = async () => {
        console.log('START - sendWithWalletConnectDelegate');

        bnbClient.setSigningDelegate(this.walletConnectCustomSigningDelegate);
        

        // Start wallet connect
        await this.walletConnectInit();
        const sequence = await getSequenceNumber(this.state.address)
        
        
        // toggle pending request indicator
        this.setState({ pendingRequest: true });

        let result = await bnbClient.transfer(this.state.address, addressToTransferTo, 0.001, "BNB", "", sequence)

        console.log(result);
        console.log(JSON.stringify(result));
    }


    render() {
        return (
            <MDBContainer>
                <MDBRow>
                    <MDBCol size="6">
                        <MDBBtn onClick={this.sendWithPrivateKey} color="primary">Transfer BNB With Private Key</MDBBtn>
                        <h4>Address: </h4><p> {this.state.privateKeyWorkflowAddress}</p>
                        <h4>Results:</h4>
                        <p>Signed Tx:</p> <p> {this.state.privateKeyWorkflowSignedTx}</p>
                        <p>Signature Pub Key: </p> <p>{this.state.privateKeySignaturePubKey}</p>
                        <p>Signature: </p> <p>{this.state.privateKeySignature}</p>
                        
                        <h4>Serialzed Transaction (You can broadcast this):</h4>
                        <p>Serialized Signed Signature: </p> <p> {this.state.privateKeyWorkflowSerializedSignedTx}</p>

                    </MDBCol>
                    <MDBCol size="6">
                        <MDBBtn onClick={this.sendWithWalletConnectDelegate} color="primary">Transfer BNB With Wallet Connect</MDBBtn>
                        <h4>Address: </h4><p> {this.state.address}</p>
                        <h4>Results:</h4>
                        <p>Signed Tx:</p> <p> {this.state.walletConnectWorkflowSignedTx}</p>
                        <p>Signature Pub Key: </p> <p>{this.state.walletConnectSignaturePubKey}</p>
                        <p>Signature: </p> <p>{this.state.walletConnectSignature}</p>
                        
                        <h4>Serialzed Transaction (You can broadcast this):</h4>
                        <p>Serialized Signed Signature: </p> <p> {this.state.walletConnectWorkflowSerializedSignedTx}</p>
                    </MDBCol>
                </MDBRow>
            </MDBContainer>
            );
    }
}

export default BnbWalletExample;