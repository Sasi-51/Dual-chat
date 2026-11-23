package com.quickchat.android;

import android.annotation.SuppressLint;
import android.bluetooth.*;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Add to a WebView with addJavascriptInterface(bridge, "QuickChat"). */
public final class QuickChatAndroidBridge {
    private static final UUID APP_UUID = UUID.fromString("8ce255c0-200a-11e0-ac64-0800200c9a66");
    private static final int TEXT=1, FILE_INFO=2, FILE_CHUNK=3, FILE_END=4, ACK=5, CHUNK_SIZE=8192;
    private final Context context; private final WebView web; private final Handler main=new Handler(Looper.getMainLooper());
    private BluetoothAdapter adapter; private BluetoothSocket socket; private DataInputStream in; private DataOutputStream out; private long uploadId=-1, uploadSize=0, uploadWritten=0;
    public QuickChatAndroidBridge(Context c, WebView w){context=c.getApplicationContext();web=w;BluetoothManager bm=(BluetoothManager)context.getSystemService(Context.BLUETOOTH_SERVICE);adapter=bm==null?BluetoothAdapter.getDefaultAdapter():bm.getAdapter();}
    private void emit(String json){main.post(()->web.evaluateJavascript("window.onQuickChatEvent && window.onQuickChatEvent("+json+")",null));}
    private void status(String s,boolean connected){try{JSONObject o=new JSONObject();o.put("event","status");o.put("message",s);o.put("connected",connected);emit(o.toString());}catch(Exception ignored){}}
    @SuppressLint("MissingPermission") @JavascriptInterface public void paired(){try{JSONArray a=new JSONArray();for(BluetoothDevice d:adapter.getBondedDevices()){JSONObject x=new JSONObject();x.put("name",d.getName());x.put("address",d.getAddress());a.put(x);}JSONObject o=new JSONObject();o.put("event","devices");o.put("devices",a);emit(o.toString());}catch(Exception e){status(e.getMessage(),false);}}
    @SuppressLint("MissingPermission") @JavascriptInterface public void connect(String address){new Thread(()->{try{close();BluetoothDevice d=adapter.getRemoteDevice(address);socket=d.createRfcommSocketToServiceRecord(APP_UUID);adapter.cancelDiscovery();socket.connect();streams();status("Connected to "+d.getName(),true);readLoop();}catch(Exception e){status("Connection failed: "+e.getMessage(),false);close();}}).start();}
    @SuppressLint("MissingPermission") @JavascriptInterface public void server(){new Thread(()->{try{close();BluetoothServerSocket server=adapter.listenUsingRfcommWithServiceRecord("QuickChat",APP_UUID);status("Waiting for connection",false);socket=server.accept();server.close();streams();status("Connected",true);readLoop();}catch(Exception e){status("Server error: "+e.getMessage(),false);close();}}).start();}
    private void streams()throws IOException{in=new DataInputStream(socket.getInputStream());out=new DataOutputStream(socket.getOutputStream());}
    private synchronized void packet(int type,byte[] p)throws IOException{if(out==null)throw new IOException("Not connected");out.writeByte(type);out.writeInt(p.length);if(p.length>0)out.write(p);out.flush();}
    @JavascriptInterface public void sendText(String text){try{packet(TEXT,text.getBytes(StandardCharsets.UTF_8));}catch(Exception e){status(e.getMessage(),false);}}
    @JavascriptInterface public void sendFileStart(String name,long size,long id){try{uploadId=id;uploadSize=size;uploadWritten=0;byte[] nb=name.getBytes(StandardCharsets.UTF_8),meta=new byte[8+nb.length];for(int i=0;i<8;i++)meta[i]=(byte)(size>>>(56-i*8));System.arraycopy(nb,0,meta,8,nb.length);packet(FILE_INFO,meta);}catch(Exception e){status("File start failed: "+e.getMessage(),false);}}
    @JavascriptInterface public void sendFileChunk(long id,String base64,long offset){try{if(id!=uploadId||offset!=uploadWritten)throw new IOException("Invalid file chunk sequence");byte[] data=android.util.Base64.decode(base64,android.util.Base64.DEFAULT);if(data.length>CHUNK_SIZE||uploadWritten+data.length>uploadSize)throw new IOException("Invalid chunk length");packet(FILE_CHUNK,data);uploadWritten+=data.length;}catch(Exception e){status("File chunk failed: "+e.getMessage(),false);}}
    @JavascriptInterface public void sendFileEnd(long id){try{if(id!=uploadId||uploadWritten!=uploadSize)throw new IOException("File upload incomplete");packet(FILE_END,new byte[0]);uploadId=-1;status("File sent",true);}catch(Exception e){status("File end failed: "+e.getMessage(),false);}}
    /** Base64 file payload; use Android content resolver to read selected file before calling. */
    @JavascriptInterface public void sendFile(String name,String base64){new Thread(()->{try{byte[] data=android.util.Base64.decode(base64,android.util.Base64.DEFAULT),nb=name.getBytes(StandardCharsets.UTF_8);byte[] meta=new byte[8+nb.length];long size=data.length;for(int i=0;i<8;i++)meta[i]=(byte)(size>>>(56-i*8));System.arraycopy(nb,0,meta,8,nb.length);packet(FILE_INFO,meta);for(int off=0;off<data.length;off+=CHUNK_SIZE){packet(FILE_CHUNK,java.util.Arrays.copyOfRange(data,off,Math.min(off+CHUNK_SIZE,data.length)));}packet(FILE_END,new byte[0]);}catch(Exception e){status("File send failed: "+e.getMessage(),false);}}).start();}
    private void readLoop(){new Thread(()->{String file="";long total=0,received=0;ByteArrayOutputStream buffer=new ByteArrayOutputStream();try{while(socket!=null&&socket.isConnected()){int type=in.readUnsignedByte(),len=in.readInt();if(len<0||len>100*1024*1024)throw new IOException("Invalid packet length");byte[] p=new byte[len];in.readFully(p);switch(type){case TEXT->{String m=new String(p,StandardCharsets.UTF_8);JSONObject o=new JSONObject();o.put("event","text");o.put("message",m);emit(o.toString());packet(ACK,p);}case FILE_INFO->{if(p.length<8)throw new IOException("Invalid file metadata");total=0;for(int i=0;i<8;i++)total=(total<<8)|(p[i]&255L);file=new String(p,8,p.length-8,StandardCharsets.UTF_8);received=0;buffer.reset();JSONObject o=new JSONObject();o.put("event","fileStart");o.put("name",file);o.put("size",total);emit(o.toString());}case FILE_CHUNK->{buffer.write(p);received+=p.length;JSONObject o=new JSONObject();o.put("event","fileProgress");o.put("percent",total==0?0:(int)(received*100/total));emit(o.toString());}case FILE_END->{JSONObject o=new JSONObject();o.put("event","file");o.put("name",file);o.put("data",android.util.Base64.encodeToString(buffer.toByteArray(),android.util.Base64.NO_WRAP));emit(o.toString());buffer.reset();}case ACK->{JSONObject o=new JSONObject();o.put("event","ack");o.put("message",new String(p,StandardCharsets.UTF_8));emit(o.toString());}}}}catch(Exception e){status("Disconnected: "+e.getMessage(),false);close();}}).start();}
    @JavascriptInterface public void disconnect(){close();status("Disconnected",false);}
    private synchronized void close(){try{if(socket!=null)socket.close();}catch(Exception ignored){}socket=null;in=null;out=null;}
}
